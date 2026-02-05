# InterviewOS Backend Server

Express API server with Gemini 3 integration for InterviewOS.

## Features

- **REST API**: Resume parsing, panelist generation, report generation
- **WebSocket**: Live interview sessions with Gemini Live API
- **Interview Orchestrator**: Intelligent question flow with context awareness
- **Retry Logic**: Automatic retry with exponential backoff
- **Error Handling**: Comprehensive error handling and validation

## API Endpoints

### Health Check
```
GET /api/health
```

### Parse Resume
```
POST /api/parse-resume
Content-Type: multipart/form-data

Body:
- resume: PDF file
- targetRole: string
```

### Generate Panelists
```
POST /api/generate-panelists
Content-Type: application/json

Body:
{
  "targetRole": "Senior Frontend Engineer",
  "resumeText": "..."
}
```

### Generate Report
```
POST /api/generate-report
Content-Type: application/json

Body:
{
  "candidate": { ... },
  "transcript": "..."
}
```

### Live Interview WebSocket
```
ws://localhost:3001/ws/interview
```

## Environment Variables

Create a `.env` file with:

```env
GEMINI_API_KEY=your_gemini_api_key
PORT=3001
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

## Running

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start
```

## Models Used

- **Gemini 3 Flash**: Resume parsing, panelist generation
- **Gemini 3 Pro**: Final report generation (with thinking)
- **Gemini 2.5 Flash**: Live audio/video interview (native audio support)
