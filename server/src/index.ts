import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import { geminiService } from './services/geminiService.js';
import { LiveInterviewHandler } from './websocket/liveInterviewHandler.js';
import { EmotionAnalyzer } from './services/emotionAnalyzer.js';
import { PresentationCoach } from './services/presentationCoach.js';
import { IndustrySpecialist, Industry } from './services/industrySpecialist.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// Middleware
app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB limit
    }
});

// Health check endpoint
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Parse resume endpoint
 */
app.post('/api/parse-resume', upload.single('resume'), async (req: Request, res: Response) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const { targetRole } = req.body;
        if (!targetRole) {
            return res.status(400).json({ error: 'Target role is required' });
        }

        // Convert buffer to base64
        const base64Pdf = req.file.buffer.toString('base64');

        // Parse resume using Gemini
        const profile = await geminiService.parseResume(base64Pdf);

        // Add target role to profile
        const result = { ...profile, targetRole };

        res.json(result);
    } catch (error: any) {
        console.error('Error parsing resume:', error);
        res.status(500).json({
            error: 'Failed to parse resume',
            message: error.message
        });
    }
});

/**
 * Generate panelists endpoint
 */
app.post('/api/generate-panelists', async (req: Request, res: Response) => {
    try {
        const { targetRole, resumeText } = req.body;

        if (!targetRole || !resumeText) {
            return res.status(400).json({ error: 'Target role and resume text are required' });
        }

        const panelists = await geminiService.generatePanelists(targetRole, resumeText);

        res.json(panelists);
    } catch (error: any) {
        console.error('Error generating panelists:', error);
        res.status(500).json({
            error: 'Failed to generate panelists',
            message: error.message
        });
    }
});

/**
 * Generate final report endpoint
 */
app.post('/api/generate-report', async (req: Request, res: Response) => {
    try {
        const { candidate, transcript } = req.body;

        if (!candidate || !transcript) {
            return res.status(400).json({ error: 'Candidate profile and transcript are required' });
        }

        const report = await geminiService.generateFinalReport(candidate, transcript);

        res.json(report);
    } catch (error: any) {
        console.error('Error generating report:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            message: error.message
        });
    }
});

/**
 * Analyze emotion endpoint (NEW)
 */
app.post('/api/analyze-emotion', async (req: Request, res: Response) => {
    try {
        const { transcript, audioData, videoFrame } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const analyzer = new EmotionAnalyzer(apiKey);

        let analysis;
        if (videoFrame) {
            analysis = await analyzer.analyzeVideo(videoFrame, transcript);
        } else if (audioData) {
            analysis = await analyzer.analyzeAudio(audioData, transcript);
        } else {
            analysis = await analyzer.analyzeText(transcript);
        }

        res.json(analysis);
    } catch (error: any) {
        console.error('Error analyzing emotion:', error);
        res.status(500).json({
            error: 'Failed to analyze emotion',
            message: error.message
        });
    }
});

/**
 * Analyze body language endpoint (NEW)
 */
app.post('/api/analyze-body-language', async (req: Request, res: Response) => {
    try {
        const { videoFrame } = req.body;

        if (!videoFrame) {
            return res.status(400).json({ error: 'Video frame is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const coach = new PresentationCoach(apiKey);
        const analysis = await coach.analyzeBodyLanguage(videoFrame);

        res.json(analysis);
    } catch (error: any) {
        console.error('Error analyzing body language:', error);
        res.status(500).json({
            error: 'Failed to analyze body language',
            message: error.message
        });
    }
});

/**
 * Analyze speech patterns endpoint (NEW)
 */
app.post('/api/analyze-speech', async (req: Request, res: Response) => {
    try {
        const { transcript, audioData } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const coach = new PresentationCoach(apiKey);
        const analysis = await coach.analyzeSpeechPatterns(transcript, audioData);

        res.json(analysis);
    } catch (error: any) {
        console.error('Error analyzing speech:', error);
        res.status(500).json({
            error: 'Failed to analyze speech patterns',
            message: error.message
        });
    }
});

/**
 * Get industry profile endpoint (NEW)
 */
app.get('/api/industry/:industry', async (req: Request, res: Response) => {
    try {
        const industry = req.params.industry as Industry;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const specialist = new IndustrySpecialist(apiKey);
        const profile = specialist.getIndustryProfile(industry);

        res.json(profile);
    } catch (error: any) {
        console.error('Error getting industry profile:', error);
        res.status(500).json({
            error: 'Failed to get industry profile',
            message: error.message
        });
    }
});

/**
 * Generate industry-specific questions endpoint (NEW)
 */
app.post('/api/industry-questions', async (req: Request, res: Response) => {
    try {
        const { industry, role, difficulty, count } = req.body;

        if (!industry || !role || !difficulty) {
            return res.status(400).json({ error: 'Industry, role, and difficulty are required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const specialist = new IndustrySpecialist(apiKey);
        const questions = await specialist.generateIndustryQuestions(
            industry as Industry,
            role,
            difficulty,
            count || 5
        );

        res.json(questions);
    } catch (error: any) {
        console.error('Error generating industry questions:', error);
        res.status(500).json({
            error: 'Failed to generate industry questions',
            message: error.message
        });
    }
});

/**
 * Evaluate industry-specific answer endpoint (NEW)
 */
app.post('/api/industry-evaluate', async (req: Request, res: Response) => {
    try {
        const { industry, question, answer, role } = req.body;

        if (!industry || !question || !answer || !role) {
            return res.status(400).json({ error: 'Industry, question, answer, and role are required' });
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const specialist = new IndustrySpecialist(apiKey);
        const evaluation = await specialist.evaluateIndustryAnswer(
            industry as Industry,
            question,
            answer,
            role
        );

        res.json(evaluation);
    } catch (error: any) {
        console.error('Error evaluating industry answer:', error);
        res.status(500).json({
            error: 'Failed to evaluate answer',
            message: error.message
        });
    }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json({
        error: 'Internal server error',
        message: err.message
    });
});

// Create HTTP server
const server = createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server, path: '/ws/interview' });

// Handle WebSocket connections
wss.on('connection', (ws: WebSocket, req) => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    console.log(`New WebSocket connection: ${sessionId}`);

    const handler = new LiveInterviewHandler(ws, sessionId);

    ws.on('close', () => {
        console.log(`WebSocket connection closed: ${sessionId}`);
    });
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📡 WebSocket server ready at ws://localhost:${PORT}/ws/interview`);
    console.log(`🌐 CORS enabled for: ${CLIENT_URL}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully...');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});
