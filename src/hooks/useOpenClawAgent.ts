import { useState, useCallback, useEffect, useRef } from "react";
import { ai, SYSTEM_PROMPT } from "../lib/gemini";
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  writeBatch
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { Modality, FunctionDeclaration, Type } from "@google/genai";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  modelId?: string;
  attachments?: string[];
};

export type Task = {
  id: string;
  title: string;
  status: "pending" | "completed" | "cancelled";
  priority: "low" | "medium" | "high" | "critical";
  createdAt: Date;
  sourceTransmissionId?: string;
};

const extractTaskTool: FunctionDeclaration = {
  name: "extract_task",
  description: "Extract a specific action item or task mentioned by the operator or the agent.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: {
        type: Type.STRING,
        description: "The description of the task."
      },
      priority: {
        type: Type.STRING,
        enum: ["low", "medium", "high", "critical"],
        description: "The priority level of the task."
      }
    },
    required: ["title", "priority"]
  }
};

export function useOpenClawAgent(modelId: string = "gemini-3-flash-preview") {
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionSettings, setSessionSettings] = useState({
    ttsEnabled: false,
    thinkingLevel: "HIGH"
  });

  // Audio Context for raw PCM playback (TTS)
  const audioContextRef = useRef<AudioContext | null>(null);

  const playPCM = useCallback(async (base64Audio: string) => {
    if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    
    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    
    // PCM is usually 16-bit signed, but Gemini TTS returns float32 or int16?
    // The skill says "sample rate 24000". Let's assume 16-bit PCM.
    const floatData = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < floatData.length; i++) {
        floatData[i] = view.getInt16(i * 2, true) / 32768;
    }

    const buffer = ctx.createBuffer(1, floatData.length, 24000);
    buffer.getChannelData(0).set(floatData);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start();
  }, []);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setSessionSettings(prev => ({
            ...prev,
            ttsEnabled: data.settings?.ttsEnabled ?? false,
          }));
        } else {
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            createdAt: serverTimestamp(),
            settings: { 
                selectedModelId: modelId,
                ttsEnabled: false
            }
          });
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [modelId]);

  const toggleTTS = async () => {
    if (!currentUser) return;
    const newStatus = !sessionSettings.ttsEnabled;
    setSessionSettings(prev => ({ ...prev, ttsEnabled: newStatus }));
    const userRef = doc(db, "users", currentUser.uid);
    await updateDoc(userRef, {
        "settings.ttsEnabled": newStatus
    });
  };

  // ... (rest of history listener same as before)

  // History Listener
  useEffect(() => {
    if (!currentUser) {
      setMessages([{
        id: "initial",
        role: "assistant",
        content: "Identity required. Please establish session authentication.",
        timestamp: new Date()
      }]);
      return;
    }

    const transmissionsRef = collection(db, "users", currentUser.uid, "transmissions");
    const q = query(transmissionsRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          role: data.role,
          content: data.content,
          timestamp: data.timestamp?.toDate() || new Date(),
          modelId: data.modelId
        } as Message;
      });

      if (logs.length === 0) {
        setMessages([{
          id: "initial",
          role: "assistant",
          content: "OpenClaw active. Establish directive.",
          timestamp: new Date()
        }]);
      } else {
        setMessages(logs);
      }
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Tasks Listener
  useEffect(() => {
    if (!currentUser) return;

    const tasksRef = collection(db, "users", currentUser.uid, "tasks");
    const q = query(tasksRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskList: Task[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        taskList.push({
          id: doc.id,
          title: data.title,
          status: data.status,
          priority: data.priority || "medium",
          createdAt: data.createdAt?.toDate() || new Date(),
          sourceTransmissionId: data.sourceTransmissionId
        });
      });
      setTasks(taskList);
    });

    return () => unsubscribe();
  }, [currentUser]);

  const toggleTaskStatus = async (taskId: string, currentStatus: string) => {
    if (!currentUser) return;
    const taskRef = doc(db, "users", currentUser.uid, "tasks", taskId);
    await updateDoc(taskRef, {
        status: currentStatus === "completed" ? "pending" : "completed"
    });
  };

  const deleteTask = async (taskId: string) => {
    if (!currentUser) return;
    const taskRef = doc(db, "users", currentUser.uid, "tasks", taskId);
    await deleteDoc(taskRef);
  };

  const batchUpdateTasks = async (taskIds: string[], updates: Partial<Task>) => {
    if (!currentUser || taskIds.length === 0) return;
    const batch = writeBatch(db);
    taskIds.forEach(id => {
      const ref = doc(db, "users", currentUser.uid, "tasks", id);
      batch.update(ref, updates as any);
    });
    await batch.commit();
  };

  const batchDeleteTasks = async (taskIds: string[]) => {
    if (!currentUser || taskIds.length === 0) return;
    const batch = writeBatch(db);
    taskIds.forEach(id => {
      const ref = doc(db, "users", currentUser.uid, "tasks", id);
      batch.delete(ref);
    });
    await batch.commit();
  };

  const sendMessage = useCallback(async (text: string, imageBase64?: string) => {
    if (!text.trim() && !imageBase64 || !currentUser) return;

    const transmissionsRef = collection(db, "users", currentUser.uid, "transmissions");

    try {
      // 1. Save User Message
      const userMsgRef = await addDoc(transmissionsRef, {
        role: "user",
        content: text,
        timestamp: serverTimestamp(),
        modelId: modelId,
        attachments: imageBase64 ? [imageBase64] : []
      });

      setIsTyping(true);

      // 2. Prepare Contents
      const historyParts = messages.slice(-10).map(m => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }]
      }));

      const currentParts: any[] = [{ text: text }];
      if (imageBase64) {
          const mimeType = imageBase64.split(';')[0].split(':')[1];
          const data = imageBase64.split(',')[1];
          currentParts.push({
              inlineData: { mimeType, data }
          });
      }

      // 3. Generate AI Response
      const result = await ai.models.generateContent({
        model: modelId,
        contents: [
            ...historyParts,
            { role: "user", parts: currentParts }
        ],
        config: {
            systemInstruction: SYSTEM_PROMPT + "\n\nCRITICAL: If the operator mentions a task, action item, or directive that needs to be tracked, use the 'extract_task' tool to record it into the secure vault. \n\nINTEL: You have access to real-time world intelligence. Use googleSearch to answer queries about current world events, technical specifications, or strategic data.",
            tools: [
                { functionDeclarations: [extractTaskTool] },
                { googleSearch: {} }
            ],
            toolConfig: { includeServerSideToolInvocations: true }
        }
      });

      // Handle Tool Calls
      const functionCalls = result.functionCalls;
      if (functionCalls) {
          for (const call of functionCalls) {
              if (call.name === "extract_task") {
                  const { title, priority } = call.args as any;
                  const tasksRef = collection(db, "users", currentUser.uid, "tasks");
                  await addDoc(tasksRef, {
                      title,
                      priority,
                      status: "pending",
                      createdAt: serverTimestamp(),
                      sourceTransmissionId: userMsgRef.id
                  });
              }
          }
      }

      const responseText = result.text || (functionCalls ? "Task recorded in local intelligence vault." : "Communication fallback initiated. Directive unclear.");
      
      // 4. Save Assistant Message
      await addDoc(transmissionsRef, {
        role: "assistant",
        content: responseText,
        timestamp: serverTimestamp(),
        modelId: modelId
      });

      // 5. Optional TTS Uplink
      if (sessionSettings.ttsEnabled) {
          try {
              const ttsResult = await ai.models.generateContent({
                  model: "gemini-3.1-flash-tts-preview",
                  contents: [{ parts: [{ text: responseText }] }],
                  config: {
                      responseModalities: [Modality.AUDIO],
                      speechConfig: {
                          voiceConfig: {
                              prebuiltVoiceConfig: { voiceName: 'Kore' },
                          },
                      },
                  },
              });
              const audioData = ttsResult.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
              if (audioData) {
                  playPCM(audioData);
              }
          } catch (ttsErr) {
              console.error("TTS Uplink Failed:", ttsErr);
          }
      }

    } catch (error) {
      console.error("Gemini/Firestore Error:", error);
      throw error; // Propagate for UI alert system
    } finally {
      setIsTyping(false);
    }
  }, [messages, modelId, currentUser, sessionSettings.ttsEnabled, playPCM]);

  return { 
    messages, 
    tasks,
    isTyping, 
    sendMessage, 
    currentUser, 
    isLoading,
    sessionSettings,
    toggleTTS,
    toggleTaskStatus,
    deleteTask,
    batchUpdateTasks,
    batchDeleteTasks
  };
}
