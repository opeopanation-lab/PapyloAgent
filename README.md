<div align="center">
<img width="1200" height="475" alt="Papylinux Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Papylinux - Powered by PapyloAgent

**Platform:** Papylinux  
**AI Assistant:** PapyloAgent  
**Company:** OPA NATION

This is the official deployment repository for PapyloAgent, OPA NATION's sovereign AI assistant running on the Papylinux platform.

View your app in AI Studio: https://ai.studio/apps/a0624aa8-2057-477c-88a0-a42930ef1067

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

### Mobile and PWA Setup

- The app is optimized for mobile-first use and supports install prompts on supported browsers.
- For local testing, open the app in a Chromium-based mobile browser or device emulator.
- Ensure your `.env.local` includes `VITE_GEMINI_API_KEY` so the PapyloAgent can initialize properly.

### About OPA NATION

OPA NATION develops sovereign, open-architecture AI solutions. Papylinux is our flagship platform for deploying AI agents with enterprise-grade security and autonomy.
