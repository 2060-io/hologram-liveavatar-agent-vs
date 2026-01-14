# 🎭 Hologram LiveAvatar Agent

A Hologram agent that integrates **HeyGen's LiveAvatar Web SDK** to provide an interactive AI-powered video avatar demo within the Hologram ecosystem.

![Live Avatar Demo](https://img.shields.io/badge/HeyGen-LiveAvatar-blueviolet)
![Hologram](https://img.shields.io/badge/Hologram-Compatible-green)

## ✨ Features

- 🎭 **Live Video Avatar** - Real-time AI avatar with lip-synced responses
- 🔐 **DIDComm Secure** - End-to-end encrypted via VS Agent
- 📱 **Mobile Optimized** - Works in Hologram's embedded WebView
- 🎤 **Voice Interaction** - Talk to the avatar using your microphone

## 📋 Prerequisites

| Requirement | Purpose | Get It |
|------------|---------|--------|
| Docker | VS Agent container | [Install](https://docker.com) |
| Node.js 18+ | Bot server | [Install](https://nodejs.org) |
| pnpm | Package manager | `npm i -g pnpm` |
| ngrok | Public URL tunnel | [Get free](https://ngrok.com) |
| Hologram App | Mobile client | [Download](https://hologram.zone) |
| HeyGen API Key | LiveAvatar API | [Get key](https://liveavatar.com) |

## 🚀 Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your HeyGen API credentials
```

Required values from your [HeyGen Dashboard](https://liveavatar.com):
- `LIVEAVATAR_API_KEY` - Your API key
- `LIVEAVATAR_AVATAR_ID` - Choose an avatar
- `LIVEAVATAR_VOICE_ID` - Choose a voice
- `LIVEAVATAR_CONTEXT_ID` - Your context/persona ID

### 3. Run (3 Terminals)

**Terminal 1: Start ngrok**
```bash
ngrok http 3001
# Note the URL: https://xxxxx.ngrok-free.app
```

**Terminal 2: Start bot server**
```bash
pnpm dev
# Wait for: 🎭 LiveAvatar Agent running
```

**Terminal 3: Start VS Agent (PowerShell)**
```powershell
.\scripts\docker-run.ps1 xxxxx
# Replace xxxxx with your ngrok subdomain
```

### 4. Connect with Hologram

1. Open http://localhost:3001/invitation in browser
2. Scan QR code with Hologram app
3. Tap the avatar link to start video chat! 🎉

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│              📱 Hologram Mobile App                  │
│                  (WebView)                          │
└────────────────────┬────────────────────────────────┘
                     │ DIDComm (E2E Encrypted)
                     ▼
┌─────────────────────────────────────────────────────┐
│              🐳 VS Agent (Docker)                    │
│            Protocol Handler • Connections           │
└────────────────────┬────────────────────────────────┘
                     │ HTTP Webhooks
                     ▼
┌─────────────────────────────────────────────────────┐
│          🤖 LiveAvatar Bot Server                    │
│   Express.js • Session Management • Avatar UI       │
└────────────────────┬────────────────────────────────┘
                     │ REST API
                     ▼
┌─────────────────────────────────────────────────────┐
│           ☁️ HeyGen LiveAvatar API                   │
│        Session Tokens • LiveKit Streaming           │
└─────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
hologram-liveavatar-agent/
├── src/
│   ├── bot.ts                    # Express server entry
│   ├── config/                   # Configuration
│   ├── controllers/              # Route handlers
│   ├── services/                 # LiveAvatar API service
│   └── dto/                      # Data types
├── public/
│   └── avatar.html               # Avatar UI page
├── scripts/
│   ├── docker-run.sh             # Linux/Mac VS Agent
│   └── docker-run.ps1            # Windows VS Agent
├── package.json
└── .env.example
```

## 📡 API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| GET | `/avatar` | Avatar UI page |
| GET | `/invitation` | Connection QR page |
| POST | `/api/session` | Create avatar session |
| POST | `/message-received` | VS Agent webhook |
| POST | `/connection-established` | VS Agent webhook |

## 💬 Commands

Chat commands available in Hologram:

- `/start` or `start` - Launch the avatar session
- `/help` - Show available commands

---

**Built with ❤️ for the Hologram ecosystem**

[Hologram](https://hologram.zone) • [VS Agent](https://github.com/2060-io/vs-agent) • [HeyGen LiveAvatar](https://liveavatar.com)
