# InterviewOS

**AI-Powered Interview Preparation Platform with Multi-Panelist Simulation & Real-Time Evaluation**

[![Gemini 3 API](https://img.shields.io/badge/Gemini%203-API-blue)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)

---

## Overview

InterviewOS is an AI-powered interview preparation platform that simulates multi-panelist interviews with real-time audio/video, adaptive questioning, and comprehensive evaluation feedback. Powered by Google Gemini 3, it provides:

- **Adaptive AI Interviewers** — 3 distinct panelists with unique personalities and question styles
- **Real-Time Live Session** — Gemini Live API for ultra-low latency audio conversation
- **Emotion & Presentation Coaching** — Confidence, nervousness, body language analysis
- **Industry Specialization** — FAANG, Finance, Consulting, Medical, Legal, Startup prep
- **Comprehensive Analytics** — Multi-dimensional scoring, improvements, and panelist feedback

---

## Architecture

### Main System Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (React + Vite)"]
        RU[Resume Upload]
        PC[Panel Config]
        LI[Live Interview]
        EM[Emotion Display]
        DB[Dashboard]
    end

    subgraph Backend["Backend (Node.js + Express)"]
        REST[REST API]
        WS[WebSocket Server]
        GO[Gemini Orchestrator]
    end

    subgraph Services["Core Services"]
        GS[Gemini Service]
        IO[Interview Orchestrator]
        EA[Emotion Analyzer]
        PC2[Presentation Coach]
        IS[Industry Specialist]
    end

    subgraph Gemini["Google Gemini APIs"]
        GF[Gemini 3 Flash]
        GP[Gemini 3 Pro]
        GL[Gemini 2.5 Live]
    end

    RU --> REST
    PC --> REST
    LI --> WS
    LI --> REST
    EM --> REST
    REST --> DB

    REST --> GO
    WS --> GO
    GO --> GS
    GO --> IO
    REST --> EA
    REST --> PC2
    REST --> IS

    GS --> GF
    GS --> GP
    GS --> GL
```

### User Flow

```mermaid
flowchart LR
    A[Landing] --> B[Upload Resume]
    B --> C[Parse with Gemini]
    C --> D[Generate Panelists]
    D --> E[Configure Panel]
    E --> F[Start Interview]
    F --> G[Live Session]
    G --> H[End Interview]
    H --> I[Generate Report]
    I --> J[Dashboard]
```

### Data Flow: Interview Session

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant WebSocket
    participant LiveHandler
    participant Gemini

    User->>Frontend: Speak (audio)
    Frontend->>WebSocket: Send PCM audio
    WebSocket->>LiveHandler: Forward to Gemini Live
    LiveHandler->>Gemini: Real-time audio stream
    Gemini->>LiveHandler: Audio response + transcript
    LiveHandler->>WebSocket: Forward response
    WebSocket->>Frontend: Audio + text
    Frontend->>User: Play audio, show transcript
```

### Backend Architecture

```mermaid
flowchart TB
    subgraph API["Express API"]
        H[api/health]
        P[api/parse-resume]
        G[api/generate-panelists]
        R[api/generate-report]
        E[api/analyze-emotion]
        B[api/analyze-body-language]
        I[api/industry]
    end

    subgraph WS["WebSocket"]
        LI[ws/interview]
    end

    subgraph Core["Service Layer"]
        GS[GeminiService]
        IO[InterviewOrchestrator]
        EA[EmotionAnalyzer]
        PC[PresentationCoach]
        IS[IndustrySpecialist]
    end

    P --> GS
    G --> GS
    R --> GS
    LI --> IO
    IO --> GS
    E --> EA
    B --> PC
    I --> IS
```

### Evaluation Pipeline

```mermaid
flowchart LR
    T[Transcript] --> G[Gemini Pro]
    G --> S[Parse Scores]
    S --> V[Validate Scores]
    V --> SA[Sample Analysis]
    SA --> R[Final Report]
    R --> D[Dashboard]
```

---

## Features

| Feature | Description |
|--------|-------------|
| **Resume Parsing** | PDF, DOC, DOCX support — extracts skills, experience, education |
| **Panel Generation** | 3 AI interviewers with Indian names, distinct personalities, gender-matched voices |
| **Live Interview** | Real-time audio via Gemini Live API, streaming transcription |
| **Adaptive Depth** | 5-level question depth (intro → base → deep) based on responses |
| **Difficulty Levels** | Easy, Medium, Hard, Extreme — affects tone and probing |
| **Emotion Analysis** | Confidence, nervousness, enthusiasm from transcript/audio |
| **Body Language** | Posture, eye contact, gestures (sample data due to API limits) |
| **Report Generation** | Technical, Communication, Culture Fit scores + panelist comments |
| **Sample Analytics** | Body/voice/temporal analysis derived from score (with API-limits warning) |

---

## Quick Start

### Prerequisites

- **Node.js** 20+
- **Gemini API Key** — [Get one here](https://ai.google.dev/)
- **npm** or **yarn**

### Installation

```bash
# Clone
git clone https://github.com/yourusername/InterviewOS.git
cd InterviewOS

# Frontend
npm install

# Backend
cd server && npm install && cd ..
```

### Environment

**Backend** (`server/.env`):

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
CLIENT_URL=http://localhost:3000
```

**Frontend** (`.env` or `.env.local`):

```env
VITE_MIN_INTERVIEW_DURATION_SECONDS=30
```

### Run

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
npm run dev
```

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:3001
- **WebSocket**: ws://localhost:3001/ws/interview

---

## API Reference

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/parse-resume` | Parse resume (PDF/DOC/DOCX) |
| `POST` | `/api/generate-panelists` | Generate AI interviewers |
| `POST` | `/api/generate-report` | Generate evaluation report |

### Advanced Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze-emotion` | Emotion & sentiment analysis |
| `POST` | `/api/analyze-body-language` | Body language analysis |
| `GET` | `/api/industry/:industry` | Industry profile |
| `POST` | `/api/industry-questions` | Industry-specific questions |
| `POST` | `/api/industry-evaluate` | Industry evaluation |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://localhost:3001/ws/interview` | Live interview session |

---

## Tech Stack

| Layer | Technologies |
|-------|---------------|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, Recharts, Axios |
| **Backend** | Node.js 20, Express, WebSocket (ws), Multer |
| **AI** | Gemini 3 Flash, Gemini 3 Pro, Gemini 2.5 Flash Live |
| **Services** | GeminiService, InterviewOrchestrator, EmotionAnalyzer, PresentationCoach, IndustrySpecialist |

---

## Project Structure

```
InterviewOS/
├── components/          # React UI components
│   ├── LiveInterview.tsx
│   ├── Dashboard.tsx
│   ├── PanelConfiguration.tsx
│   └── ResumeUploader.tsx
├── server/
│   └── src/
│       ├── index.ts              # Express + WebSocket entry
│       ├── services/
│       │   ├── geminiService.ts
│       │   ├── interviewOrchestrator.ts
│       │   ├── emotionAnalyzer.ts
│       │   ├── presentationCoach.ts
│       │   └── industrySpecialist.ts
│       └── websocket/
│           └── liveInterviewHandler.ts
├── src/
│   ├── services/apiClient.ts
│   ├── hooks/useVideoAnalysis.ts
│   └── utils/reportDownload.ts
├── types.ts
└── vite.config.ts
```

---

## Gemini Models

| Use Case | Model | Note |
|----------|-------|------|
| Resume parsing | `gemini-3-flash-preview` | Fast extraction |
| Panelist generation | `gemini-3-flash-preview` | Persona creation |
| Final evaluation | `gemini-3-pro-preview` | Deep reasoning |
| Live interview | `gemini-2.5-flash-native-audio-preview` | Only model with Live API |

---

## Sample Data Notice

Body language, voice, temporal, and spatial analysis use **sample/demonstration data** due to API rate limits on the free tier. Core scores (Technical, Communication, Culture Fit) and panelist feedback are based on your actual interview transcript.

---

## License

MIT License — see LICENSE file for details.
