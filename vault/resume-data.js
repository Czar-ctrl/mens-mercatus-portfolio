/* Mens Mercatus · Katlego Mokoto — single source of truth for CV variants.
   Grounded in Katlego_Mokoto_Resume_AI_Engineering.pdf + mensmercatus.online
   + Blueprint .NET robot source (/workspace/mercatus-cartel/robot/backend) +
   THINK app (React 19 + Vite + TypeScript) + think-proxy.
   Do not invent employers, degrees, or dates beyond these sources.
   Updated 2026-10-06: ASP.NET Core / C# + THINK. */
window.RESUME_DATA = {
  meta: {
    name: "Katlego Mokoto",
    brand: "Mens Mercatus",
    status: "AVAILABLE",
    headline: "AI Engineer · AI Systems Architect · Full-Stack + .NET / C#",
    tagline: "AI engineer and developer — products, platforms, agentic systems, and ASP.NET backends.",
    location: "Johannesburg, South Africa · Open to Johannesburg, Pretoria, Cape Town & Durban (on-site, hybrid or remote)",
    remote: "On-site, hybrid or remote · SA metros + global",
    site: "https://mensmercatus.online",
    siteLabel: "mensmercatus.online",
    email: "katlego.mokoto.km@gmail.com",
    emailAlt: "katlego.mokoto@icloud.com",
    phone: "065 842 4274",
    phoneIntl: "+27658424274",
    roles: ["Systems architect", "Full-stack engineer", ".NET / C# developer", "AI architect"],
    targeting:
      "Targeting AI engineering / AI developer / full-stack .NET roles at OpenAI, Anthropic, Google DeepMind, Meta AI, Microsoft AI, NVIDIA, and applied-AI startups (xAI, Waymo, ElevenLabs, Scale AI, Sierra, Cursor, Perplexity, Cognition, Replit, Mercor).",
    portfolioProof:
      "Portfolio proof: Blueprint .NET robot (ASP.NET Core + Gemini), THINK (React 19 + Vite + TypeScript), Mens Mercatus Sound Dex, Forex Mercatus Codex, JobNet, Antigravity / local LLM stack. Walkthrough: mensmercatus.online/assets/video/walkthrough.mp4"
  },
  stack: {
    languages: ["Python", "TypeScript", "C#", "JavaScript", "SQL", "Bash", "Solidity"],
    frontend: ["React", "React 19", "Next.js", "Vite", "Flutter", "Tailwind", "Web Audio / DAW UIs"],
    ai: ["LLM orchestration", "RAG", "LangChain", "Ollama", "Agent Zero", "Gemini (OpenAI-compatible API)", "prompt/tool agents", "ChromaDB", "local inferencing (Apple Silicon M4)"],
    backend: ["ASP.NET Core 8", ".NET / C#", "FastAPI", "Node.js", "Express", "Django", "WebSockets", "Redis"],
    data: ["PostgreSQL", "Pandas", "NumPy", "yfinance", "OR-Tools"],
    cloud: ["Nebius", "Docker", "Linux", "systemd", "nginx", "Cloudflare", "CI/CD", "AWS", "Ubuntu VPS", "edge / local-first AI"],
    audio: ["Web Audio API", "mic capture", "stem DSP", "generative synthesis", "live-voice WebSocket relay"],
    systems: ["P2P/BLE mesh", "agentic workflows", "Cursor IDE automation", "per-IP rate limits"]
  },
  domains: [
    {
      title: "Agentic AI & Local Compute",
      tags: ["OLLAMA", "AGENT ZERO", "CURSOR", "RAG", "CHROMADB", "APPLE SILICON M4", "GEMINI"],
      body: "Design and ship sovereign agent stacks: tool-using agents, RAG over live data, local LLM orchestration to cut API dependency, and high-throughput inferencing on Apple Silicon. Cloud path uses Gemini via an OpenAI-compatible chat/completions client."
    },
    {
      title: "Applied AI Product Engineering",
      tags: ["FULL-STACK", "ASP.NET", "REACT 19", "WEB AUDIO", "AUTOMATION", "USER-FACING AI TOOLS"],
      body: "Build end-to-end AI products (generation UIs, copilots, job-automation meshes, multimodal workspaces) with production-minded UX, offline-capable clients, and clear human-in-the-loop controls."
    },
    {
      title: ".NET / C# backends & VPS ops",
      tags: ["ASP.NET CORE 8", "SYSTEMD", "NGINX", "CLOUDFLARE", "UBUNTU VPS"],
      body: "Ship ASP.NET Core 8 minimal APIs that call Gemini through an OpenAI-compatible interface, with retries on 429/5xx, running as systemd services behind nginx on an Ubuntu VPS with Cloudflare in front of the static site."
    }
  ],
  flagships: [
    {
      id: "cartel-dotnet",
      name: "Mercatus Assist / Blueprint Robot",
      period: "2026",
      kind: "ASP.NET Core 8 · Gemini",
      status: "LIVE",
      statusNote: "LIVE path via /api/cartel/ → VPS robot; DEMO fallback if backend unhealthy.",
      summary: "ASP.NET Core 8 minimal API (C#) that calls Gemini through an OpenAI-compatible chat/completions client so the provider can be swapped in config. Exponential backoff retries on 429/5xx. Runs as a systemd service on an Ubuntu VPS behind nginx; static site on DreamHost sits behind Cloudflare.",
      bullets: [
        "Live Assist chat at mensmercatus.online/apps/mercatus-assist/ with labelled DEMO fallback when the robot is down.",
        "Same-origin PHP proxy → VPS; architecture notes at mensmercatus.online/apps/net-workspace/."
      ],
      chips: ["C#", "ASP.NET Core 8", "Gemini", "systemd", "nginx", "Cloudflare"]
    },
    {
      id: "think",
      name: "THINK — Hybrid Social & AI",
      period: "2026",
      kind: "React 19 + Vite + TypeScript",
      status: "LIVE",
      statusNote: "Public demo with per-IP daily caps on chat, image, video, and live-voice.",
      summary: "Multimodal Gemini workspace (chat, live voice, Net Sites, Net Code, Netzar Protocol, Net Learn). Front end is React 19 + Vite + TypeScript; server-side Node proxy calls Gemini and relays live-voice over WebSocket, with per-IP rate limits.",
      bullets: [
        "Live at mensmercatus.online/think/.",
        "60s portfolio walkthrough: mensmercatus.online/assets/video/walkthrough.mp4."
      ],
      chips: ["React 19", "Vite", "TypeScript", "Gemini proxy", "WebSocket live-voice"]
    },
    {
      id: "soundx",
      name: "SoundX / Sound Dex",
      period: "2026",
      kind: "Browser DAW / AI music",
      status: "DEMO",
      statusNote: "Honest demo — sound stays in the browser, not a hosted session.",
      summary: "Original browser DAW with AI Producer (order-taking studio assistant), demo stem split, 16-step beats, mic/vocal pipelines, VST slot framework, and in-house text-to-music / stem / continuation generation.",
      bullets: [
        "Generate, demo play, mic, and AI Producer on mensmercatus.online apps hub.",
        "Gold/black/white Mens Mercatus product UI; no third-party music-site dependency."
      ],
      chips: ["Web Audio", "Agents", "DSP", "TypeScript/JS"]
    },
    {
      id: "jobnet",
      name: "JobNet",
      period: "2026",
      kind: "Career automation",
      status: "DEMO",
      statusNote: "Draft-only — live read-only shortlist demo; never applies or sends mail.",
      summary: "Weekday pipeline: noon multi-board scrape; CV tailor + AI Hawk draft fills with human confirm before submit; Gmail reply watch + SMS/email notify.",
      bullets: [
        "Noon scrape across top AI employers + early-stage trackers.",
        "3 AM CV tailor + draft fills; human-in-the-loop gates before any submit."
      ],
      chips: ["Automation", "Agents", "Gmail", "macOS shell"]
    },
    {
      id: "forex",
      name: "Forex Mercatus Codex",
      period: "2026",
      kind: "Python desk :8790",
      status: "DEMO",
      statusNote: "Simulated paper research only — not a brokerage.",
      summary: "~87MB Python + Highcharts desk for FX workflows; Chart, Multi, Whales, Flow, Bot. Hosted on VPS as live paper research.",
      bullets: [
        "Inventory and load-path optimization for faster cold start and clearer static serving.",
        "Market data fused with interactive analysis desks."
      ],
      chips: ["Python", "Highcharts", "yfinance", "Paper only"]
    }
  ],
  projects: [
    {
      name: "Project Antigravity",
      period: "Mar 2026 – Present",
      role: "AI Systems Architect & Founder",
      bullets: [
        "Sovereign, decentralized AI OS for autonomous task execution and specialized agentic workflows.",
        "Terminal-first AI tooling on M4 with Ollama; Nebius for scalable training/deploy of custom models; Agent Zero + Cursor orchestration."
      ],
      chips: ["Ollama", "Agent Zero", "Nebius", "LLM Ops"]
    },
    {
      name: "Mens Mercatus Ecosystem",
      period: "Ongoing · mensmercatus.online",
      role: "Full-stack, .NET & AI systems",
      bullets: [
        "Telegram AI trading assistant: RAG + live financial feeds for XAUUSD / cyclical models (SMT, Gann frameworks) with institutional-order context.",
        "Brand, UI/UX, and portfolio architecture including the Blueprint ASP.NET Assist robot and the THINK multimodal workspace."
      ],
      chips: ["Python", "C# / ASP.NET", "LangChain", "ChromaDB", "React / Next.js"]
    },
    {
      name: "Messmakers / Flutter Overlay",
      period: "2026",
      role: "Mobile UI systems",
      bullets: [
        "Flutter package fixing z-order: gray AI sound/volume bar above white social band; theme extension, haptics, demo app — drop-in for Messmakers / ThinkPulse clients."
      ],
      chips: ["Flutter", "Dart", "UI systems"]
    },
    {
      name: "ProxNet · Infrastructure.log",
      period: "Parallel systems work",
      role: "Edge & mesh",
      bullets: [
        "BLE/WebRTC mesh social (offline-first) and M4 SSD arrays for model weights / vector DBs — edge-ready AI compute hygiene."
      ],
      chips: ["React Native", "P2P", "Edge"]
    }
  ],
  narrative: [
    "Hands-on builder of agentic products: copilots that execute studio/job/market actions with explicit user confirmation gates.",
    "Comfortable in Python, TypeScript, and C# / ASP.NET Core; ships Gemini-backed APIs on a VPS (systemd + nginx) and React 19 fronts on the portfolio.",
    "Background in fleet/logistics optimization (OR-Tools) and diesel/mechanical operations — strong systems thinking under real constraints."
  ],
  footer:
    "Portfolio: mensmercatus.online · THINK: /think/ · Walkthrough: /assets/video/walkthrough.mp4 · Johannesburg, South Africa · Open to Johannesburg, Pretoria, Cape Town & Durban (on-site, hybrid or remote) · AI eng and .NET roles."
};
