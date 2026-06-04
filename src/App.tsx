import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Mic, 
  MicOff, 
  Shield, 
  Cpu, 
  Menu, 
  X, 
  ChevronRight,
  User,
  Zap,
  Activity,
  MessageSquare,
  History,
  Settings,
  Bell,
  Lock,
  Globe,
  Trash2,
  Search,
  Paperclip,
  Volume2,
  VolumeX,
  Plus,
  ArrowUpRight,
  HardDrive,
  Database,
  Layers,
  Dna,
  Clock,
  CheckCircle2,
  Circle,
  Flag,
  ListTodo,
  AlertTriangle,
  Download,
  Terminal,
  RefreshCcw,
  UserCircle,
  Copy,
  CheckSquare,
  Square
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useOpenClawAgent, Message, Task } from "./hooks/useOpenClawAgent";
import { cn } from "./lib/utils";
import { auth, signInWithGoogle } from "./lib/firebase";
import { signOut, updateProfile } from "firebase/auth";

const MODELS = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", code: "GEMINI_3F" },
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro", code: "GEMINI_3.1P" },
  { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite", code: "GEMINI_3.1FL" },
];

type Screen = "chat" | "history" | "tasks" | "intelligence" | "settings";

// --- Components for "Real App" Feel ---

function Alert({ message, type = "error", onClose }: { message: string, type?: "error" | "warning" | "success", onClose: () => void }) {
    return (
        <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className={cn(
                "fixed top-4 left-4 right-4 z-[100] p-4 rounded-2xl border flex items-center gap-4 shadow-2xl backdrop-blur-xl",
                type === "error" ? "bg-red-500/10 border-red-500/30 text-red-400" :
                type === "warning" ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-400" :
                "bg-green-500/10 border-green-500/30 text-green-400"
            )}
        >
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium flex-1">{message}</p>
            <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4" />
            </button>
        </motion.div>
    );
}

// --- Main App ---

export default function App() {
  const [selectedModelId, setSelectedModelId] = useState("gemini-3-flash-preview");
  const { 
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
  } = useOpenClawAgent(selectedModelId);
  
  const [activeScreen, setActiveScreen] = useState<Screen>("chat");
  const [inputText, setInputText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [notification, setNotification] = useState<{ message: string, type: "error" | "warning" | "success" } | null>(null);
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState("");
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Stats for the "Hardware" feel
  const [stats, setStats] = useState({
    neuralLoad: 12,
    uplinkQuality: 98,
    latency: 24,
    uptime: "48:12:05"
  });

  useEffect(() => {
    if (currentUser) {
        setNewDisplayName(currentUser.displayName || "");
    }
  }, [currentUser]);

  useEffect(() => {
    const timer = setInterval(() => {
        setStats(prev => ({
            ...prev,
            neuralLoad: Math.floor(Math.random() * 15) + 10,
            latency: Math.floor(Math.random() * 5) + 22
        }));
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setNotification({ message: "Sovereign platform authorized and installed.", type: "success" });
    }
    setDeferredPrompt(null);
  };

  // Auto-scroll on chat screen
  useEffect(() => {
    if (activeScreen === "chat" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping, activeScreen]);

  const handleSend = async () => {
    if (!inputText.trim() && !selectedImage) return;
    try {
        await sendMessage(inputText, selectedImage || undefined);
        setInputText("");
        setSelectedImage(null);
    } catch (err: any) {
        // "Real App" Error Handling for Firestore
        const errorInfo = {
            error: err.message,
            operationType: 'create',
            path: 'users/transmissions',
            authInfo: {
                userId: currentUser?.uid || "anon",
                email: currentUser?.email || "none",
                emailVerified: currentUser?.emailVerified || false,
                isAnonymous: currentUser?.isAnonymous || false,
                providerInfo: currentUser?.providerData?.map(p => ({
                    providerId: p.providerId,
                    displayName: p.displayName || "",
                    email: p.email || ""
                })) || []
            }
        };
        console.error("Critical Security Breach / Permission Error:", JSON.stringify(errorInfo, null, 2));
        setNotification({ message: "Security protocol error. Verify operator authorization.", type: "error" });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            setSelectedImage(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleUpdateProfile = async () => {
    if (!currentUser || !newDisplayName.trim()) return;
    setIsUpdatingProfile(true);
    try {
        await updateProfile(currentUser, { displayName: newDisplayName });
        setNotification({ message: "Operator profile synchronized.", type: "success" });
    } catch (err) {
        setNotification({ message: "Sync failed. Profile immutable.", type: "error" });
    } finally {
        setIsUpdatingProfile(false);
    }
  };

  const handleExportData = () => {
    const data = JSON.stringify({ 
        operator: currentUser?.email,
        transmissions: messages,
        directives: tasks,
        exportedAt: new Date().toISOString()
    }, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `NATION_AGENT_LOG_${Date.now()}.json`;
    a.click();
    setNotification({ message: "Local intelligence vault exported.", type: "success" });
  };

  const toggleTaskSelection = (id: string) => {
    setSelectedTaskIds(prev => 
      prev.includes(id) ? prev.filter(tid => tid !== id) : [...prev, id]
    );
  };

  const handleBatchComplete = async () => {
    if (selectedTaskIds.length === 0) return;
    try {
        await batchUpdateTasks(selectedTaskIds, { status: "completed" });
        setNotification({ message: `${selectedTaskIds.length} directives marked as completed.`, type: "success" });
        setSelectedTaskIds([]);
    } catch (err) {
        setNotification({ message: "Batch status update failed.", type: "error" });
    }
  };

  const handleBatchDelete = async () => {
    if (selectedTaskIds.length === 0) return;
    if (!confirm(`Permanently delete ${selectedTaskIds.length} operational directives?`)) return;
    try {
        await batchDeleteTasks(selectedTaskIds);
        setNotification({ message: `${selectedTaskIds.length} directives purged from vault.`, type: "success" });
        setSelectedTaskIds([]);
    } catch (err) {
        setNotification({ message: "Batch purge failed.", type: "error" });
    }
  };

  const toggleSelectAllTasks = () => {
    if (selectedTaskIds.length === tasks.length) {
        setSelectedTaskIds([]);
    } else {
        setSelectedTaskIds(tasks.map(t => t.id));
    }
  };

  const isBatchMode = selectedTaskIds.length > 0;

  const toggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setNotification({ message: "Speech recognition not supported in this browser.", type: "warning" });
      return;
    }

    if (!isListening) {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInputText(transcript);
        sendMessage(transcript);
        setInputText("");
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } else {
      setIsListening(false);
    }
  };

  if (isLoading) {
    return (
      <div className="h-screen w-full bg-[#0F172A] flex flex-col items-center justify-center gap-6">
        <div className="relative">
          <Shield className="w-12 h-12 text-[#38BDF8] animate-pulse" />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-[-12px] border-2 border-dashed border-[#38BDF8]/20 rounded-full"
          />
        </div>
        <p className="font-mono text-[10px] text-[#38BDF8] uppercase tracking-[0.4em] animate-pulse">Initializing Protocols...</p>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="h-screen w-full bg-[#0F172A] flex flex-col items-center justify-center p-6 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_100%)] from-[#38BDF8]/5">
        <div className="w-full max-w-sm space-y-12 flex flex-col items-center text-center">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-[#1E293B] border border-[#334155] rounded-3xl flex items-center justify-center mx-auto shadow-2xl">
              <Shield className="w-8 h-8 text-[#38BDF8]" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase">OpenClaw</h1>
            <p className="text-sm text-[#94A3B8] font-mono leading-relaxed">Secure communication terminal. Establish operator identity to begin mission transcripts.</p>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full group relative flex items-center justify-center gap-3 bg-[#F1F5F9] text-[#0F172A] p-4 rounded-2xl font-bold transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-white/5"
          >
            <Globe className="w-5 h-5" />
            Establish Secure Link
          </button>

          <p className="text-[10px] font-mono text-[#334155] uppercase tracking-[0.2em]">End-to-end encrypted session</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-[480px] mx-auto bg-[#0F172A] text-[#F1F5F9] font-sans selection:bg-[#38BDF8] selection:text-[#0F172A] shadow-2xl relative overflow-hidden border-x border-[#334155]/20">
      <AnimatePresence>
        {notification && <Alert message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}
      </AnimatePresence>
      
      {/* Sidebar (Branding/Soul) */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 lg:hidden"
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed inset-y-0 left-0 w-80 bg-[#1E293B] border-r border-[#334155] z-[60] p-6 flex flex-col gap-8 shadow-2xl shadow-black/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                      opacity: [0.8, 1, 0.8]
                    }}
                    transition={{ 
                      duration: 4, 
                      repeat: Infinity, 
                      ease: "easeInOut" 
                    }}
                  >
                    <Shield className="w-5 h-5 text-[#38BDF8]" />
                  </motion.div>
                  <span className="font-mono text-xs tracking-widest uppercase font-bold text-[#94A3B8]">Nation Core</span>
                </div>
                <button onClick={() => setIsSidebarOpen(false)}>
                  <X className="w-5 h-5 text-[#94A3B8] hover:text-white transition-colors" />
                </button>
              </div>

              <div className="space-y-8">
                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold mb-3 flex items-center justify-between">
                    Operator
                    <span className={cn(
                        "text-[9px] flex items-center gap-1",
                        isOnline ? "text-[#38BDF8]" : "text-red-400"
                    )}>
                        <div className={cn("w-1 h-1 rounded-full", isOnline ? "bg-[#38BDF8] animate-ping" : "bg-red-400")} />
                        {isOnline ? "Online" : "Terminated"}
                    </span>
                  </h3>
                  <div className="flex items-center gap-4 bg-[#0F172A]/50 rounded-2xl p-4 border border-[#334155] group relative overflow-hidden">
                    <div className="absolute inset-0 bg-technical opacity-10" />
                    <img 
                      src={currentUser.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser.uid}`} 
                      alt="Operator"
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-xl border border-[#334155] relative z-10"
                    />
                    <div className="flex flex-col overflow-hidden relative z-10">
                      <span className="text-sm font-bold text-white truncate">{currentUser.displayName}</span>
                      <span className="text-[10px] font-mono text-[#475569] uppercase truncate">ID::{currentUser.uid.slice(0, 8)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold mb-3">Neural Core</h3>
                  <div className="bg-[#0F172A]/50 rounded-xl p-4 border border-[#334155] backdrop-blur-sm relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#38BDF8]/5 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Cpu className="w-3 h-3 text-[#38BDF8]" />
                            <span className="text-[10px] font-mono text-white">{MODELS.find(m => m.id === selectedModelId)?.code}</span>
                        </div>
                        <span className="text-[10px] font-mono text-[#38BDF8]">{stats.neuralLoad}%</span>
                    </div>
                    <div className="h-1 bg-[#0F172A] rounded-full overflow-hidden border border-[#334155]">
                        <motion.div 
                            animate={{ width: `${stats.neuralLoad}%` }}
                            className="h-full bg-[#38BDF8]"
                        />
                    </div>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-[#334155]/30">
                   <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold">Protocol Stats</h3>
                   {[
                       { icon: Activity, label: "Latency", value: `${stats.latency}ms` },
                       { icon: Globe, label: "Uplink", value: `${stats.uplinkQuality}%`, color: "text-[#38BDF8]" },
                       { icon: ListTodo, label: "Open Ops", value: tasks.filter(t => t.status === "pending").length },
                       { icon: Shield, label: "Encryption", value: "GCM-256" }
                   ].map((stat, i) => (
                       <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <stat.icon className="w-3 h-3 text-[#94A3B8]" />
                            <span className="text-[10px] font-mono text-[#94A3B8] uppercase">{stat.label}</span>
                          </div>
                          <span className={cn("text-[10px] font-mono font-bold", stat.color || "text-white")}>{stat.value}</span>
                       </div>
                   ))}
                </div>
              </div>

              <div className="mt-auto border-t border-[#334155]/50 pt-6">
                <div className="flex items-center gap-3 text-[#94A3B8]">
                  <Activity className="w-4 h-4 text-[#22C55E] animate-pulse" />
                  <span className="text-[10px] uppercase tracking-wider font-mono">Heartbeat :: 54 BPM</span>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="h-16 shrink-0 border-b border-[#334155] flex items-center justify-between px-6 bg-[#0F172A]/80 backdrop-blur-xl z-40 sticky top-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(true)}
            className="p-2 -ml-2 hover:bg-[#1E293B] rounded-full transition-colors"
          >
            <Menu className="w-5 h-5 text-[#94A3B8]" />
          </button>
          <div className="flex flex-col">
            <h1 className="text-sm font-bold tracking-widest bg-gradient-to-r from-white to-[#64748B] bg-clip-text text-transparent uppercase">
              OpenClaw
            </h1>
            <div className="flex items-center gap-1.5">
               <div className="w-1 h-1 rounded-full bg-[#22C55E] animate-pulse" />
               <span className="text-[8px] font-mono uppercase text-[#94A3B8] tracking-[0.2em]">Secure Link Est.</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-[#1E293B] rounded-full text-[#94A3B8]">
            <Bell className="w-4 h-4" />
          </button>
          <div className="h-4 w-px bg-[#334155]" />
          <div className="w-8 h-8 rounded-full bg-[#1E293B] border border-[#334155] overflow-hidden">
            <img src={currentUser.photoURL || ""} alt="U" className="w-full h-full object-cover" />
          </div>
        </div>
      </header>

      {/* Screens Container */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        <AnimatePresence mode="wait">
          {activeScreen === "chat" && (
            <motion.div
              key="chat"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              className="absolute inset-0 flex flex-col"
            >
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 no-scrollbar relative grid-technical">
                <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
                    <div className="w-full h-1 bg-[#38BDF8] animate-[scanline_8s_linear_infinite]" />
                </div>
                
                {messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn(
                      "flex flex-col max-w-[90%]",
                      message.role === "user" ? "ml-auto items-end" : "items-start"
                    )}
                  >
                    <div className={cn(
                      "group relative",
                      message.role === "user" ? "text-right" : "text-left"
                    )}>
                      <div className={cn(
                        "p-5 rounded-2xl text-[13px] leading-relaxed relative flex flex-col gap-3",
                        message.role === "user" 
                          ? "bg-[#1E293B] border border-[#334155] text-white rounded-tr-none shadow-2xl" 
                          : "bg-[#1E293B]/80 backdrop-blur-md border border-[#334155] text-[#F1F5F9] rounded-tl-none"
                      )}>
                        {message.attachments?.map((att, idx) => (
                            <img key={idx} src={att} className="max-w-full rounded-lg border border-[#334155] shadow-inner" alt="Transmission Attachment" referrerPolicy="no-referrer" />
                        ))}
                        <div className="prose prose-invert prose-xs max-w-none">
                          <ReactMarkdown>
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                      <div className={cn(
                        "flex gap-3 mt-1 px-1",
                        message.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}>
                        <span className="text-[7px] font-mono text-[#475569] uppercase tracking-widest">{message.timestamp.toLocaleTimeString()}</span>
                        {message.modelId && <span className="text-[7px] font-mono text-[#38BDF8] uppercase tracking-widest">{MODELS.find(m => m.id === message.modelId)?.code}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
                {isTyping && (
                  <div className="flex items-center gap-3 text-[#38BDF8]">
                    <div className="p-2 bg-[#1E293B] border border-[#334155] rounded-xl flex items-center justify-center">
                        <Zap className="w-4 h-4 animate-pulse" />
                    </div>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-[10px] font-mono uppercase tracking-[0.2em] animate-pulse">Neural Thread Processing...</span>
                        <div className="flex gap-1 h-0.5 w-24 bg-[#0F172A] rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ x: "-100%" }}
                                animate={{ x: "100%" }}
                                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                className="w-full h-full bg-[#38BDF8]"
                            />
                        </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Chat Input */}
              <div className="py-6 px-4 bg-gradient-to-t from-[#0F172A] via-[#0F172A] to-transparent">
                <div className="flex flex-col gap-3 max-w-4xl mx-auto border border-[#334155] p-3 rounded-3xl bg-[#1E293B]/40 backdrop-blur-xl">
                    {selectedImage && (
                        <div className="relative group self-start ml-2">
                             <img src={selectedImage} className="w-20 h-20 object-cover rounded-xl border border-[#334155]" alt="Preview" />
                             <button 
                                onClick={() => setSelectedImage(null)}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full shadow-lg"
                             >
                                <X className="w-3 h-3" />
                             </button>
                        </div>
                    )}
                    <div className="flex items-end gap-3">
                        <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 bg-[#0F172A] text-[#94A3B8] hover:text-white rounded-2xl border border-[#334155] transition-all"
                        >
                            <Paperclip className="w-5 h-5" />
                        </button>
                        <input 
                            type="file" 
                            hidden 
                            ref={fileInputRef} 
                            accept="image/*" 
                            onChange={handleFileSelect}
                        />
                        <div className="flex-1 relative">
                            <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSend();
                                }
                            }}
                            placeholder="Issue mission command..."
                            className="w-full bg-transparent border-none py-3 px-2 text-sm focus:outline-none transition-all resize-none max-h-32 no-scrollbar"
                            rows={1}
                            />
                        </div>
                        <div className="flex items-center gap-2 pr-1">
                            <button
                                onClick={toggleVoice}
                                className={cn(
                                "p-3 rounded-2xl transition-all border border-[#334155] bg-[#0F172A]",
                                isListening ? "bg-red-500 text-white border-red-400 animate-pulse" : "text-[#94A3B8]"
                                )}
                            >
                                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={isTyping || (!inputText.trim() && !selectedImage)}
                                className="p-3 bg-[#38BDF8] text-[#0F172A] rounded-2xl flex items-center justify-center disabled:opacity-20 shadow-lg shadow-blue-500/20"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeScreen === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="absolute inset-0 overflow-y-auto px-6 py-8"
            >
              <h2 className="text-xl font-bold mb-6 flex items-center gap-3">
                <History className="w-6 h-6 text-[#38BDF8]" />
                Intel Logs
              </h2>

              {/* Search Bar */}
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan transmissions..."
                  className="w-full bg-[#1E293B] border border-[#334155] rounded-xl py-3 pl-11 pr-4 text-sm focus:outline-none focus:border-[#38BDF8]/40 transition-all placeholder:text-[#475569]"
                />
              </div>

              <div className="space-y-4">
                {messages.length > 1 ? (
                  messages
                    .filter(m => m.id !== 'initial')
                    .filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
                    .reverse()
                    .map((m) => (
                    <div key={m.id} className="p-4 bg-[#1E293B] border border-[#334155] rounded-2xl flex gap-4 hover:border-[#38BDF8]/30 transition-colors cursor-pointer group">
                      <div className="shrink-0 w-8 h-8 rounded-full bg-[#0F172A] border border-[#334155] flex items-center justify-center">
                        {m.role === 'user' ? <User className="w-4 h-4 text-[#94A3B8]" /> : <Zap className="w-4 h-4 text-[#38BDF8]" />}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex justify-between items-center mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-mono text-[#94A3B8] uppercase">{m.role === 'user' ? 'Operator' : 'Agent'}</span>
                            {m.modelId && <span className="text-[7px] px-1 bg-[#334155] rounded text-[#475569] font-mono">{MODELS.find(mod => mod.id === m.modelId)?.code}</span>}
                          </div>
                          <span className="text-[9px] font-mono text-[#475569]">{m.timestamp.toLocaleDateString()} {m.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <p className="text-sm text-[#F1F5F9] truncate opacity-80 group-hover:opacity-100">{m.content}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#334155] self-center" />
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-64 text-[#94A3B8] gap-4">
                    <History className="w-12 h-12 opacity-10" />
                    <p className="text-sm font-mono uppercase tracking-widest opacity-50">Local logs empty</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeScreen === "intelligence" && (
            <motion.div
              key="intelligence"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 overflow-y-auto px-6 py-8 grid-technical"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Terminal className="w-6 h-6 text-[#38BDF8]" />
                  Internal Intelligence
                </h2>
                <span className="text-[10px] font-mono text-[#38BDF8] animate-pulse uppercase tracking-[0.2em]">Live Telemetry</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                  {[
                      { label: "Memory Density", value: `${(messages.length / 1000).toFixed(2)} TB`, icon: Database },
                      { label: "Neural Response", value: `${stats.latency}ms`, icon: Zap },
                      { icon: Activity, label: "Cognitive Load", value: `${stats.neuralLoad}%` },
                      { icon: Globe, label: "Uplink Status", value: isOnline ? "Secure" : "Severed", color: isOnline ? "text-[#38BDF8]" : "text-red-400" },
                  ].map((stat, i) => (
                      <div key={i} className="bg-[#1E293B] border border-[#334155] rounded-3xl p-5 flex flex-col gap-2 group transition-all hover:border-[#38BDF8]/40">
                          <div className="flex items-center justify-between">
                             <div className="p-2 bg-[#0F172A] rounded-xl">
                                <stat.icon className="w-4 h-4 text-[#94A3B8]" />
                             </div>
                             <div className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] opacity-50 shadow-[0_0_8px_rgba(56,189,248,0.5)]" />
                          </div>
                          <p className="text-[9px] font-mono text-[#475569] uppercase tracking-widest mt-2">{stat.label}</p>
                          <p className={cn("text-lg font-bold truncate", stat.color || "text-white")}>{stat.value}</p>
                      </div>
                  ))}

                  <div className="col-span-full bg-[#1E293B] border border-[#334155] rounded-3xl p-6 relative overflow-hidden h-48 flex items-end">
                       <div className="absolute inset-0 bg-[#0F172A] opacity-50" />
                       <div className="absolute inset-x-6 top-6 h-24 flex items-end gap-1">
                          {Array.from({ length: 40 }).map((_, i) => (
                              <motion.div 
                                key={i}
                                initial={{ height: "10%" }}
                                animate={{ height: `${Math.random() * 80 + 20}%` }}
                                transition={{ duration: 0.5, repeat: Infinity, repeatType: "mirror", delay: i * 0.05 }}
                                className="flex-1 bg-[#38BDF8]/20 rounded-t-sm"
                              />
                          ))}
                       </div>
                       <div className="relative z-10 w-full flex justify-between items-center">
                           <div>
                               <p className="text-lg font-bold">Neural Flux Capacity</p>
                               <p className="text-[10px] font-mono text-[#94A3B8] uppercase">Adaptive response spectrum active</p>
                           </div>
                           <Layers className="w-10 h-10 text-[#38BDF8] opacity-10" />
                       </div>
                  </div>
              </div>

              <div className="mt-8 p-6 bg-[#38BDF8]/5 border border-[#38BDF8]/10 rounded-3xl flex items-center justify-between">
                  <div className="flex items-center gap-4">
                      <div className="p-3 bg-[#38BDF8]/20 rounded-2xl">
                          <Dna className="w-6 h-6 text-[#38BDF8]" />
                      </div>
                      <div>
                          <p className="text-sm font-bold text-white">Sovereign Link Integrity</p>
                          <p className="text-[10px] text-[#94A3B8] font-mono uppercase tracking-widest">Operator signature verified</p>
                      </div>
                  </div>
                  <ArrowUpRight className="w-5 h-5 text-[#38BDF8]" />
              </div>
            </motion.div>
          )}

          {activeScreen === "tasks" && (
            <motion.div
              key="tasks"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="absolute inset-0 overflow-y-auto px-6 py-8 grid-technical no-scrollbar"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex flex-col gap-1">
                  <h2 className="text-xl font-bold flex items-center gap-3">
                    <ListTodo className="w-6 h-6 text-[#38BDF8]" />
                    Operational Directives
                  </h2>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={toggleSelectAllTasks}
                      className="text-[10px] font-mono text-[#475569] uppercase tracking-widest hover:text-[#38BDF8] transition-colors"
                    >
                      {selectedTaskIds.length === tasks.length && tasks.length > 0 ? "Deselect All" : "Select All"}
                    </button>
                    {selectedTaskIds.length > 0 && (
                      <span className="text-[10px] font-mono text-[#38BDF8] uppercase tracking-widest">
                        ({selectedTaskIds.length} Selected)
                      </span>
                    )}
                  </div>
                </div>
                <div className="px-3 py-1 bg-[#1E293B] border border-[#334155] rounded-full text-[10px] font-mono text-[#38BDF8] uppercase tracking-widest">
                    {tasks.filter(t => t.status === "pending").length} Pending
                </div>
              </div>

              {/* Batch Action Bar */}
              <AnimatePresence>
                {selectedTaskIds.length > 0 && (
                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    className="flex items-center justify-between gap-4 mb-6 p-4 bg-[#38BDF8]/5 border border-[#38BDF8]/20 rounded-2xl sticky top-0 z-10 backdrop-blur-md"
                  >
                    <span className="text-xs font-bold text-[#38BDF8]">Batch Operations Active</span>
                    <div className="flex items-center gap-2">
                       <button 
                          onClick={handleBatchComplete}
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#38BDF8]/10 text-[#38BDF8] border border-[#38BDF8]/20 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-[#38BDF8]/20 transition-all"
                       >
                          <CheckSquare className="w-4 h-4" />
                          Complete
                       </button>
                       <button 
                          onClick={handleBatchDelete}
                          className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/20 transition-all"
                       >
                          <Trash2 className="w-4 h-4" />
                          Purge
                       </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4 pb-20">
                {tasks.length > 0 ? (
                  tasks.map((task) => (
                    <motion.div
                      layout
                      key={task.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "p-4 border rounded-2xl transition-all relative group bg-[#1E293B]/60 backdrop-blur-md",
                        task.status === "completed" ? "border-[#334155] opacity-50" : "border-[#334155] hover:border-[#38BDF8]/40",
                        selectedTaskIds.includes(task.id) && "ring-2 ring-[#38BDF8] border-[#38BDF8]"
                      )}
                      onClick={() => toggleTaskSelection(task.id)}
                    >
                      <div className="flex items-start gap-4 cursor-pointer">
                        <div className="mt-0.5 shrink-0 transition-colors">
                           {selectedTaskIds.includes(task.id) ? (
                               <CheckSquare className="w-5 h-5 text-[#38BDF8]" />
                           ) : (
                               <Square className="w-5 h-5 text-[#475569]" />
                           )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className={cn(
                            "text-[13px] leading-relaxed transition-all",
                            task.status === "completed" ? "line-through text-[#64748B]" : "text-white"
                          )}>
                            {task.title}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                             <div className="flex items-center gap-1.5 px-2 py-0.5 bg-[#0F172A] rounded-md border border-[#334155]">
                                <Flag className={cn(
                                    "w-3 h-3",
                                    task.priority === "critical" ? "text-red-500" :
                                    task.priority === "high" ? "text-orange-500" :
                                    task.priority === "medium" ? "text-yellow-500" : "text-blue-500"
                                )} />
                                <span className="text-[8px] font-mono uppercase text-[#94A3B8]">{task.priority}</span>
                             </div>
                             <span className="text-[8px] font-mono text-[#475569] uppercase">{task.createdAt.toLocaleDateString()}</span>
                             {task.status === "completed" && (
                               <div className="flex items-center gap-1 text-[#22C55E]">
                                  <CheckCircle2 className="w-3 h-3" />
                                  <span className="text-[8px] font-mono uppercase tracking-widest">Completed</span>
                               </div>
                             )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-96 gap-6 text-[#94A3B8] opacity-20">
                    <div className="relative">
                        <ListTodo className="w-16 h-16" />
                        <Dna className="absolute -top-4 -right-4 w-8 h-8 animate-pulse text-[#38BDF8]" />
                    </div>
                    <p className="font-mono text-xs uppercase tracking-[0.4em]">No active directives</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeScreen === "settings" && (
            <motion.div
              key="settings"
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute inset-0 overflow-y-auto px-6 py-8 grid-technical"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-xl font-bold flex items-center gap-3">
                    <Settings className="w-6 h-6 text-[#38BDF8]" />
                    Core Configuration
                </h2>
                <span className="text-[10px] font-mono text-[#475569] uppercase tracking-widest">v2.4.9_ALPHA</span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* PWA Install Action */}
                <AnimatePresence>
                  {deferredPrompt && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="col-span-full"
                    >
                      <button 
                        onClick={handleInstallApp}
                        className="w-full bg-[#38BDF8]/10 border border-[#38BDF8]/40 rounded-3xl p-6 flex flex-col items-center gap-4 group hover:bg-[#38BDF8]/20 transition-all"
                      >
                         <div className="p-4 bg-[#38BDF8]/20 rounded-full group-hover:scale-110 transition-transform">
                            <Download className="w-8 h-8 text-[#38BDF8]" />
                         </div>
                         <div className="text-center">
                            <p className="text-sm font-bold text-white uppercase tracking-widest">Authorize Sovereign PWA Installation</p>
                            <p className="text-[10px] text-[#94A3B8] font-mono mt-1">Enable standalone encrypted operational terminal</p>
                         </div>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Bento Card: Intelligence */}
                <div className="col-span-full bg-[#1E293B] border border-[#334155] rounded-3xl p-6 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Cpu className="w-32 h-32" />
                  </div>
                  <div className="relative z-10 flex flex-col h-full">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold mb-4">Neural Intelligence</h3>
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="flex-1 space-y-4">
                            <div className="space-y-1">
                                <label className="text-[11px] font-mono text-white opacity-60 ml-1">Cognitive Origin (Searching Enabled)</label>
                                <select 
                                    value={selectedModelId}
                                    onChange={(e) => setSelectedModelId(e.target.value)}
                                    className="w-full bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm font-mono text-[#F1F5F9] focus:outline-none focus:border-[#38BDF8] transition-all appearance-none cursor-pointer"
                                >
                                    {MODELS.map(m => (
                                    <option key={m.id} value={m.id}>{m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="p-4 bg-[#0F172A]/50 border border-[#334155] rounded-2xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Volume2 className={cn("w-5 h-5", sessionSettings.ttsEnabled ? "text-[#38BDF8]" : "text-[#475569]")} />
                                    <div>
                                        <p className="text-sm font-medium">Neural Voice Uplink</p>
                                        <p className="text-[10px] text-[#94A3B8] font-mono">Agent will respond via audio</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={toggleTTS}
                                    className={cn(
                                        "w-12 h-6 rounded-full relative transition-all duration-300",
                                        sessionSettings.ttsEnabled ? "bg-[#38BDF8]" : "bg-[#334155]"
                                    )}
                                >
                                    <motion.div 
                                        animate={{ x: sessionSettings.ttsEnabled ? 24 : 4 }}
                                        className="w-4 h-4 bg-white rounded-full absolute top-1" 
                                    />
                                </button>
                            </div>
                        </div>
                        <div className="w-full md:w-48 bg-[#0F172A] border border-[#334155] rounded-2xl p-4 flex flex-col justify-between">
                            <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-bold">Network</p>
                                <p className="text-xl font-bold text-white">TLS 1.3</p>
                            </div>
                            <div className="space-y-1">
                                <p className="text-[9px] uppercase tracking-widest text-[#94A3B8] font-bold">Region</p>
                                <p className="text-xs font-mono text-[#38BDF8]">EU_LONDON_W2</p>
                            </div>
                        </div>
                    </div>
                  </div>
                </div>

                {/* Operator Profile */}
                <div className="col-span-full bg-[#1E293B] border border-[#334155] rounded-3xl p-6">
                    <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold mb-4">Operator Identity</h3>
                    <div className="flex flex-col md:flex-row gap-6 items-end">
                        <div className="flex-1 space-y-2">
                             <label className="text-[11px] font-mono text-white opacity-60 ml-1">Identity Display Name</label>
                             <div className="flex gap-3">
                                <input 
                                    type="text"
                                    value={newDisplayName}
                                    onChange={(e) => setNewDisplayName(e.target.value)}
                                    placeholder="Enter operator callsign..."
                                    className="flex-1 bg-[#0F172A] border border-[#334155] rounded-xl px-4 py-3 text-sm font-mono text-white focus:outline-none focus:border-[#38BDF8]"
                                />
                                <button 
                                    onClick={handleUpdateProfile}
                                    disabled={isUpdatingProfile || newDisplayName === currentUser.displayName}
                                    className="px-6 py-3 bg-[#38BDF8] text-[#0F172A] rounded-xl font-bold text-xs disabled:opacity-20 hover:scale-105 transition-all"
                                >
                                    {isUpdatingProfile ? "Syncing..." : "Update Callsign"}
                                </button>
                             </div>
                        </div>
                        <div className="w-full md:w-auto">
                            <button 
                                onClick={handleExportData}
                                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-[#1E293B] border border-[#334155] rounded-xl text-[10px] font-bold uppercase tracking-widest hover:border-[#38BDF8]/40 transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Export Sovereignty Log
                            </button>
                        </div>
                    </div>
                </div>

                {/* Bento Card: Storage */}
                <div className="bg-[#1E293B] border border-[#334155] rounded-3xl p-6 flex flex-col justify-between group">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold">Memory Vault</h3>
                            <Database className="w-4 h-4 text-[#38BDF8]" />
                        </div>
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-[#94A3B8]">Total Transmissions</span>
                                <span className="text-xs font-mono font-bold">{messages.length}</span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-[#94A3B8]">Vault Security</span>
                                <span className="text-xs font-mono font-bold text-[#22C55E]">Optimal</span>
                            </div>
                        </div>
                    </div>
                    <button className="mt-6 flex items-center justify-center gap-2 p-3 bg-[#0F172A] border border-[#334155] rounded-xl text-xs text-[#94A3B8] hover:text-white hover:border-[#38BDF8]/40 transition-all">
                        <HardDrive className="w-3 h-3" />
                        Export Data Log
                    </button>
                </div>

                {/* Bento Card: Connection */}
                <div className="bg-[#1E293B] border border-[#334155] rounded-3xl p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[10px] uppercase tracking-[0.2em] text-[#94A3B8] font-bold">Strategic Link</h3>
                            <Globe className="w-4 h-4 text-[#38BDF8]" />
                        </div>
                        <div className="flex flex-col items-center gap-2 py-2">
                             <div className="w-12 h-12 rounded-full border border-[#334155] flex items-center justify-center relative">
                                <div className="absolute inset-0 border-2 border-[#38BDF8] border-t-transparent rounded-full animate-spin" />
                                <Lock className="w-5 h-5 text-[#38BDF8]" />
                             </div>
                             <p className="text-xs text-[#F1F5F9] font-bold">AES-256 Symmetric</p>
                             <p className="text-[9px] font-mono text-[#475569] uppercase">End-to-End Tunnel</p>
                        </div>
                    </div>
                </div>

                {/* Session Terminate */}
                <div className="col-span-full border border-red-500/20 bg-red-500/5 rounded-3xl p-4 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-red-500/10 rounded-2xl">
                            <Trash2 className="w-6 h-6 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-white">Full Identity Purge</p>
                            <p className="text-[10px] text-[#94A3B8] font-mono">Sever link and sign out operator</p>
                        </div>
                    </div>
                    <button 
                        onClick={() => signOut(auth)}
                        className="px-8 py-3 bg-red-500 text-white rounded-2xl font-bold hover:bg-red-600 transition-all active:scale-95 shadow-lg shadow-red-500/20"
                    >
                        Execute
                    </button>
                </div>

                <div className="col-span-full pt-12 flex flex-col items-center gap-2 opacity-30 pb-20">
                  <div className="w-12 h-1 bg-[#334155] rounded-full" />
                  <p className="text-[9px] font-mono uppercase tracking-[0.3em]">NATION_AGENT :: SOVEREIGN_PRODUCTION_BUILD_481</p>
                  <p className="text-[8px] font-mono uppercase">© 2026 NATION_STRATEGIC_CORE</p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <nav className="h-20 shrink-0 bg-[#1E293B] border-t border-[#334155] flex items-center justify-around px-2 pb-2 z-50 sticky bottom-0">
        {[
          { id: "chat", icon: MessageSquare, label: "Mission" },
          { id: "tasks", icon: ListTodo, label: "Directives" },
          { id: "intelligence", icon: Terminal, label: "Monitor" },
          { id: "history", icon: History, label: "Intel logs" },
          { id: "settings", icon: Settings, label: "Config" }
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveScreen(item.id as Screen)}
            className={cn(
              "flex flex-col items-center gap-1.5 transition-all w-16",
              activeScreen === item.id ? "text-[#38BDF8]" : "text-[#64748B] hover:text-[#94A3B8]"
            )}
          >
            <div className={cn(
              "p-2 rounded-xl transition-all",
              activeScreen === item.id ? "bg-[#38BDF8]/10 shadow-[0_0_15px_rgba(56,189,248,0.15)]" : ""
            )}>
              <item.icon className="w-5 h-5" />
            </div>
            <span className="text-[9px] font-bold uppercase tracking-wider">{item.id === "tasks" && tasks.filter(t => t.status === "pending").length > 0 ? `${item.label} (${tasks.filter(t => t.status === "pending").length})` : item.label}</span>
            {activeScreen === "intelligence" && item.id === "intelligence" && (
                <div className="absolute top-2 w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
            )}
            {activeScreen === item.id && (
              <motion.div layoutId="nav-dot" className="w-1 h-1 bg-[#38BDF8] rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}

