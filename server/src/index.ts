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
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

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
        const { targetRole, resumeText, difficulty } = req.body;

        if (!targetRole || !resumeText) {
            return res.status(400).json({ error: 'Target role and resume text are required' });
        }

        const panelists = await geminiService.generatePanelists(targetRole, resumeText, difficulty);

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
        const { candidate, transcript, bodyLanguageHistory, emotionHistory } = req.body;

        if (!candidate || !transcript) {
            return res.status(400).json({ error: 'Candidate profile and transcript are required' });
        }

        // Log transcript stats for debugging
        const wordCount = transcript.split(/\s+/).filter((w: string) => w.length > 0).length;
        const lineCount = transcript.split('\n').filter((l: string) => l.trim().length > 0).length;
        console.log(`[Report Generation] Transcript stats: ${wordCount} words, ${lineCount} lines`);
        
        if (wordCount < 50) {
            console.warn('[Report Generation] WARNING: Very short transcript detected (< 50 words). Scores will reflect minimal engagement.');
        }

        const report = await geminiService.generateFinalReport(candidate, transcript, bodyLanguageHistory, emotionHistory);

        res.json(report);
    } catch (error: any) {
        console.error('Error generating report:', error);
        res.status(500).json({
            error: 'Failed to generate report',
            message: error.message
        });
    }
});

// Rate limiting for emotion analysis
let lastEmotionRequest = 0;
const EMOTION_THROTTLE_MS = 3000; // 3 seconds between requests

/**
 * Analyze emotion endpoint (NEW)
 */
app.post('/api/analyze-emotion', async (req: Request, res: Response) => {
    try {
        const { transcript, audioData, videoData } = req.body;

        if (!transcript) {
            return res.status(400).json({ error: 'Transcript is required' });
        }

        // Rate limiting check
        const now = Date.now();
        const timeSinceLastRequest = now - lastEmotionRequest;

        if (timeSinceLastRequest < EMOTION_THROTTLE_MS) {
            // Return a default response
            return res.json({
                primaryEmotion: 'neutral',
                confidence: 0.7,
                emotionBreakdown: { neutral: 0.7, calm: 0.2, focused: 0.1 },
                sentiment: 'neutral',
                sentimentScore: 0.5,
                energyLevel: 0.6,
                stressIndicators: [],
                recommendations: ['Continue maintaining composure'],
                timestamp: Date.now(),
                throttled: true
            });
        }

        lastEmotionRequest = now;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const analyzer = new EmotionAnalyzer(apiKey);

        let analysis;
        if (videoData) {
            analysis = await analyzer.analyzeVideo(videoData, transcript);
        } else if (audioData) {
            analysis = await analyzer.analyzeAudio(audioData, transcript);
        } else {
            analysis = await analyzer.analyzeText(transcript);
        }

        res.json(analysis);
    } catch (error: any) {
        console.error('Error analyzing emotion:', error);

        // If rate limited by API, return default response
        if (error.status === 429) {
            return res.json({
                primaryEmotion: 'neutral',
                confidence: 0.7,
                emotionBreakdown: { neutral: 0.7, calm: 0.2, focused: 0.1 },
                sentiment: 'neutral',
                sentimentScore: 0.5,
                energyLevel: 0.6,
                stressIndicators: [],
                recommendations: ['Continue maintaining composure'],
                timestamp: Date.now(),
                rateLimited: true
            });
        }

        res.status(500).json({
            error: 'Failed to analyze emotion',
            message: error.message
        });
    }
});

// Rate limiting for body language analysis
let lastBodyLanguageRequest = 0;
const BODY_LANGUAGE_THROTTLE_MS = 3000; // 3 seconds between requests

/**
 * Analyze body language endpoint (NEW)
 */
app.post('/api/analyze-body-language', async (req: Request, res: Response) => {
    try {
        const { videoData } = req.body;

        if (!videoData) {
            return res.status(400).json({ error: 'Video data is required' });
        }

        // Rate limiting check
        const now = Date.now();
        const timeSinceLastRequest = now - lastBodyLanguageRequest;

        if (timeSinceLastRequest < BODY_LANGUAGE_THROTTLE_MS) {
            // Return a default response instead of making API call
            return res.json({
                posture: { score: 0.7, issues: [], recommendation: 'Maintain good posture' },
                eyeContact: { score: 0.7, percentage: 70, issues: [], recommendation: 'Look at camera more' },
                gestures: { score: 0.7, frequency: 'appropriate', types: [], recommendation: 'Use natural gestures' },
                facialExpression: { score: 0.7, primary: 'neutral', variety: 0.5, recommendation: 'Show more expression' },
                overallScore: 70,
                grade: 'B',
                strengths: ['Maintaining composure'],
                improvements: ['Increase eye contact', 'Use more gestures'],
                timestamp: Date.now(),
                throttled: true
            });
        }

        lastBodyLanguageRequest = now;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({ error: 'API key not configured' });
        }

        const coach = new PresentationCoach(apiKey);
        const analysis = await coach.analyzeBodyLanguage(videoData);

        res.json(analysis);
    } catch (error: any) {
        console.error('Error analyzing body language:', error);

        // If rate limited by API, return default response
        if (error.status === 429) {
            return res.json({
                posture: { score: 0.7, issues: [], recommendation: 'Maintain good posture' },
                eyeContact: { score: 0.7, percentage: 70, issues: [], recommendation: 'Look at camera more' },
                gestures: { score: 0.7, frequency: 'appropriate', types: [], recommendation: 'Use natural gestures' },
                facialExpression: { score: 0.7, primary: 'neutral', variety: 0.5, recommendation: 'Show more expression' },
                overallScore: 70,
                grade: 'B',
                strengths: ['Maintaining composure'],
                improvements: ['Increase eye contact', 'Use more gestures'],
                timestamp: Date.now(),
                rateLimited: true
            });
        }

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