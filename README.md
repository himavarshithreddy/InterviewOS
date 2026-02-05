# 🎤 InterviewOS

<div align="center">
<img width="1200" height="475" alt="InterviewOS Banner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />

**AI-Powered Interview Preparation Platform with Emotion Intelligence & Industry Specialization**

[![Gemini 3 API](https://img.shields.io/badge/Gemini%203-API-blue)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-blue)](https://react.dev/)
[![Node.js](https://img.shields.io/badge/Node.js-20-green)](https://nodejs.org/)

[Live Demo](#) • [Documentation](./HACKATHON_README.md) • [Features](./FEATURES.md) • [Setup Guide](./SETUP_GUIDE.md)

</div>

---

## 🌟 What is InterviewOS?

InterviewOS is a revolutionary AI-powered interview preparation platform that goes beyond traditional Q&A practice. Using Google's **Gemini 3 API**, it provides:

- 🧠 **Adaptive AI Interviewers** - Multi-panelist simulation with intelligent question orchestration
- 😊 **Emotion Intelligence** - Real-time confidence, nervousness, and enthusiasm detection
- 🎭 **Presentation Coaching** - Body language analysis and filler word tracking
- 🏢 **Industry Specialization** - FAANG, Finance, Consulting, Medical, Legal, and Startup prep
- 💭 **Transparent AI Reasoning** - See why the AI asks each question (Thought Signatures™)
- 🔄 **Self-Correction** - AI autonomously improves question quality
- 📊 **Comprehensive Analytics** - Multi-dimensional scoring and trend analysis

---

## ✨ Key Features

### 🎯 Core Interview Experience

#### **InterviewOrchestrator™** - Adaptive Intelligence System
- **Context-Aware Questioning**: Analyzes answer completeness and quality
- **Adaptive Depth Control**: 5 levels from surface to deep technical
- **Smart Panelist Rotation**: Balances fairness and expertise matching
- **Topic Coverage Tracking**: Ensures comprehensive evaluation

#### **Live Interview Session**
- Real-time audio/video with Gemini Live API
- Ultra-low latency (< 250ms)
- Streaming transcription
- Active speaker detection
- Natural conversation flow

#### **Multi-Panelist Simulation**
- 3 distinct AI interviewers with unique personalities
- Customizable personas (name, role, focus, expertise)
- Color-coded avatars for easy identification
- Coordinated questioning strategy

### 🚀 Advanced AI Features

#### **1. Emotion & Sentiment Analysis** 😊
*Real-time emotional intelligence coaching*

- **Confidence Detection** (0-1 scale): Measures how confident you sound
- **Nervousness Detection** (0-1 scale): Identifies anxiety indicators
- **Enthusiasm Detection** (0-1 scale): Gauges engagement level
- **Voice Metrics**: Pace, volume, clarity, monotone detection
- **Facial Analysis**: Eye contact, expressions, micro-expressions
- **Sentiment Scoring**: Positive/neutral/negative with recommendations

**API Endpoint**: `POST /api/analyze-emotion`

#### **2. Body Language & Presentation Coach** 🎭
*Hollywood-level presentation training*

- **Posture Analysis**: Detect slouching, fidgeting
- **Eye Contact Tracking**: Percentage looking at camera
- **Gesture Recognition**: Frequency and appropriateness
- **Filler Word Detection**: "Um", "like", "you know" counter
- **Speech Pace Analysis**: Words per minute optimization
- **Overall Presentation Score**: 0-100 with letter grade (A-F)

**API Endpoints**: 
- `POST /api/analyze-body-language`
- `POST /api/analyze-speech`

#### **3. Industry-Specific Deep Dives** 🏢
*Hyper-specialized preparation for your target industry*

**Supported Industries:**
- 🖥️ **FAANG** - System design, algorithms, leadership principles
- 💰 **Finance** - Financial modeling, market analysis, brainteasers
- 📊 **Consulting** - Case frameworks, market sizing, business judgment
- 🏥 **Medical** - Clinical reasoning, patient care, ethics
- ⚖️ **Legal** - Case analysis, legal reasoning, advocacy
- 🚀 **Startup** - Product thinking, growth mindset, adaptability

**Features:**
- Industry-specific question generation
- Custom evaluation rubrics
- Cultural fit assessment
- Company-specific preparation (Google, Meta, Amazon, etc.)
- Real interview questions database

**API Endpoints**:
- `GET /api/industry/:industry`
- `POST /api/industry-questions`
- `POST /api/industry-evaluate`

### 💡 Innovation Features

#### **Thought Signatures™** 💭
*Transparent AI reasoning*

- See why the AI chose each question
- Confidence scoring (0-1)
- Alternative approaches considered
- Next action planning
- Complete audit trail

#### **Self-Correction Loop™** 🔄
*Autonomous quality improvement*

- Detects vague or poorly formed questions
- Checks complexity vs. depth level
- Ensures topic relevance
- Tracks improvement over time
- Common issue pattern detection

#### **Marathon Agent** 📅
*Long-running session support*

- Session export/resume capability
- Multi-day interview preparation
- Progress persistence
- Comprehensive state management

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
│  • Resume Upload (PDF/DOC/DOCX)                              │
│  • Panel Configuration                                       │
│  • Live Interview (Audio/Video)                              │
│  • Real-time Emotion Display                                 │
│  • Body Language Feedback                                    │
│  • Performance Dashboard                                     │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP REST API + WebSocket
                         │
┌────────────────────────▼────────────────────────────────────┐
│              Backend (Node.js + Express)                     │
│  • Resume Parsing API                                        │
│  • Panelist Generation                                       │
│  • Emotion Analysis                                          │
│  • Body Language Coach                                       │
│  • Industry Specialist                                       │
│  • Live Interview WebSocket                                  │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ Gemini 3 API
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  Google Gemini 3 APIs                        │
│  • gemini-3-flash-preview (Fast analysis)                    │
│  • gemini-3-pro-preview (Deep reasoning, 1M context)         │
│  • gemini-2.5-flash-native-audio (Live API - real-time)      │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 20+ (for both frontend and backend)
- **Gemini API Key** ([Get one here](https://ai.google.dev/))
- **npm** or **yarn**

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/InterviewOS.git
cd InterviewOS
```

#### 2. Install Frontend Dependencies

```bash
npm install
```

#### 3. Install Backend Dependencies

```bash
cd server
npm install
cd ..
```

#### 4. Configure Environment Variables

**Backend** (`server/.env`):
```env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=3001
CLIENT_URL=http://localhost:3000
```

**Frontend** (`.env.local`):
```env
VITE_API_URL=http://localhost:3001
```

#### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd server
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **WebSocket**: ws://localhost:3001/ws/interview

---

## 📖 Usage Guide

### Basic Interview Flow

1. **Upload Resume** 📄
   - Support for PDF, DOC, DOCX (up to 10MB)
   - AI extracts skills, experience, education
   - Specify target role

2. **Review AI Panel** 👥
   - 3 AI interviewers generated based on role
   - Customize names, roles, focus areas
   - Each panelist has unique expertise

3. **Live Interview** 🎤
   - Real-time audio/video conversation
   - Streaming transcription
   - Adaptive questioning (5 depth levels)
   - 30-minute session

4. **Get Feedback** 📊
   - Multi-dimensional scoring
   - Detailed strengths/weaknesses
   - Actionable improvements
   - Emotion and presentation analytics

### Advanced Features

#### Emotion Analysis
```bash
POST /api/analyze-emotion
{
  "transcript": "I worked on a scalability project...",
  "audioData": "base64_audio",
  "videoFrame": "base64_image"
}
```

#### Industry-Specific Prep
```bash
POST /api/industry-questions
{
  "industry": "FAANG",
  "role": "Senior Software Engineer",
  "difficulty": "senior",
  "count": 5
}
```

---

## 🛠️ Tech Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Recharts** - Data visualization
- **Axios** - HTTP client

### Backend
- **Node.js 20** - Runtime
- **Express** - Web framework
- **WebSocket (ws)** - Real-time communication
- **TypeScript** - Type safety
- **Multer** - File uploads
- **@google/genai** - Gemini SDK

### AI/ML
- **Gemini 3 Flash** - Fast analysis, transcription
- **Gemini 3 Pro** - Deep reasoning, 1M context
- **Gemini 2.5 Flash** - Live API (real-time audio)

---

## 📊 API Endpoints

### Core Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Health check |
| `POST` | `/api/parse-resume` | Parse resume (PDF/DOC/DOCX) |
| `POST` | `/api/generate-panelists` | Generate AI interviewers |
| `POST` | `/api/generate-report` | Generate final evaluation |

### Advanced Features

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/analyze-emotion` | Emotion & sentiment analysis |
| `POST` | `/api/analyze-body-language` | Body language analysis |
| `POST` | `/api/analyze-speech` | Speech pattern analysis |
| `GET` | `/api/industry/:industry` | Get industry profile |
| `POST` | `/api/industry-questions` | Generate industry questions |
| `POST` | `/api/industry-evaluate` | Evaluate with industry criteria |

### WebSocket

| Path | Description |
|------|-------------|
| `ws://localhost:3001/ws/interview` | Live interview session |

---

## 📚 Documentation

- **[HACKATHON_README.md](./HACKATHON_README.md)** - Gemini 3 Hackathon submission details
- **[FEATURES.md](./FEATURES.md)** - Complete feature list (current + proposed)
- **[ADVANCED_FEATURES.md](./ADVANCED_FEATURES.md)** - Advanced AI features documentation
- **[LATENCY_OPTIMIZATION.md](./LATENCY_OPTIMIZATION.md)** - Performance optimization details
- **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** - Detailed setup instructions

---

## 🎯 Use Cases

### For Job Seekers
- Practice for FAANG interviews
- Improve presentation skills
- Reduce interview anxiety
- Get industry-specific preparation
- Track improvement over time

### For Students
- Prepare for campus placements
- Learn interview best practices
- Build confidence
- Practice technical and behavioral questions

### For Career Switchers
- Understand new industry norms
- Learn cultural expectations
- Practice industry-specific scenarios
- Get targeted feedback

### For Professionals
- Prepare for promotions
- Practice executive interviews
- Refine leadership communication
- Industry-specific upskilling

---

## 🏆 Competitive Advantages

| Feature | InterviewOS | Traditional Prep | Competitors |
|---------|-------------|------------------|-------------|
| **AI Interviewers** | ✅ 3 personas | ❌ None | ⚠️ 1 generic |
| **Emotion Detection** | ✅ Real-time | ❌ None | ❌ None |
| **Body Language** | ✅ AI-powered | ❌ None | ⚠️ Manual |
| **Industry Specialization** | ✅ 6 industries | ❌ Generic | ⚠️ 1-2 max |
| **Adaptive Depth** | ✅ 5 levels | ❌ Fixed | ⚠️ 2 levels |
| **Thought Transparency** | ✅ Full | ❌ None | ❌ None |
| **Self-Correction** | ✅ Autonomous | ❌ None | ❌ None |
| **Multimodal Analysis** | ✅ Audio+Video+Text | ❌ Text only | ⚠️ Audio only |

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Workflow

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Google Gemini Team** - For the incredible Gemini 3 API
- **AI Studio** - For the development platform
- **Open Source Community** - For the amazing tools and libraries

---

## 📞 Contact & Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/yourusername/InterviewOS/issues)
- **Email**: support@interviewos.com
- **Twitter**: [@InterviewOS](https://twitter.com/InterviewOS)
- **Discord**: [Join our community](https://discord.gg/interviewos)

---

## 🗺️ Roadmap

### Q1 2026 ✅
- [x] Core interview flow
- [x] Multi-panelist simulation
- [x] Emotion analysis
- [x] Body language coach
- [x] Industry specialization

### Q2 2026 🚧
- [ ] AR/VR interview simulation
- [ ] Peer review network
- [ ] Company-specific prep database
- [ ] Mobile app (iOS/Android)
- [ ] Interview recording & playback

### Q3 2026 📅
- [ ] Gamification (Interview Mastery Path)
- [ ] Performance analytics dashboard
- [ ] Real-time job market integration
- [ ] Neuro-adaptive learning
- [ ] Multi-language support

---

<div align="center">

**Built with ❤️ using Google Gemini 3 API**

⭐ Star us on GitHub if you find this helpful!

[Get Started](#-quick-start) • [View Demo](#) • [Read Docs](./HACKATHON_README.md)

</div>
