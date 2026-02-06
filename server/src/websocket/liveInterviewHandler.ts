import { WebSocket } from 'ws';
import { GoogleGenAI, Modality } from '@google/genai';
import { InterviewOrchestrator } from '../services/interviewOrchestrator.js';
import { MODELS } from '../services/geminiService.js';

interface CandidateProfile {
    name: string;
    experience: string[];
    skills: string[];
    education: string[];
    rawResumeText: string;
    targetRole?: string;
}

interface Panelist {
    id: string;
    name: string;
    role: string;
    focus: string;
    avatarColor: string;
    description: string;
    voiceName?: string;
}

interface SessionData {
    candidate: CandidateProfile;
    panelists: Panelist[];
}

/**
 * Handle WebSocket connections for live interview sessions
 */
export class LiveInterviewHandler {
    private ws: WebSocket;
    private orchestrator: InterviewOrchestrator | null = null;
    private sessionId: string;
    private currentPanelistId: string | null = null;


    constructor(ws: WebSocket, sessionId: string) {
        this.ws = ws;
        this.sessionId = sessionId;
        this.setupHandlers();
    }

    private setupHandlers(): void {
        this.ws.on('message', async (data: Buffer) => {
            try {
                const message = JSON.parse(data.toString());
                await this.handleMessage(message);
            } catch (error) {
                console.error('Error handling WebSocket message:', error);
                this.sendError('Failed to process message');
            }
        });

        this.ws.on('close', () => {
            this.cleanup();
        });

        this.ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            this.cleanup();
        });
    }

    private async handleMessage(message: any): Promise<void> {
        switch (message.type) {
            case 'init':
                await this.initializeSession(message.data);
                break;
            case 'audio':
                await this.handleAudio(message.data);
                break;
            case 'video':
                await this.handleVideo(message.data);
                break;
            case 'pause':
                this.handlePause();
                break;
            case 'resume':
                this.handleResume();
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    /**
     * Initialize interview session with Gemini Live
     */
    private async initializeSession(data: SessionData): Promise<void> {
        try {
            const { candidate, panelists } = data;

            // Create orchestrator
            this.orchestrator = new InterviewOrchestrator(
                this.sessionId,
                candidate,
                panelists,
                30 // 30 minute interview
            );

            // Get initial question parameters
            const questionParams = await this.orchestrator.determineNextQuestion();

            // Initialize Gemini Live session
            const apiKey = process.env.GEMINI_API_KEY;
            if (!apiKey) throw new Error('API key not configured');

            const ai = new GoogleGenAI({ apiKey });
            this.currentPanelistId = questionParams.panelist.id;

            await this.connectGeminiSession(ai, questionParams.systemInstruction, questionParams.panelist.voiceName || 'Kore');


            // LATENCY OPTIMIZATION: Configure for minimal delay
            // Session connection moved to helper method


            this.send({ type: 'initialized', data: { sessionId: this.sessionId } });
        } catch (error: any) {
            console.error('Failed to initialize session:', error);
            this.sendError('Failed to initialize interview session');
        }
    }

    /**
     * Connect to Gemini Live session with specific voice and instructions
     */
    private async connectGeminiSession(ai: GoogleGenAI, systemInstruction: string, voiceName: string): Promise<void> {
        console.log(`Connecting Gemini session with voice: ${voiceName}`);

        this.geminiSession = await ai.live.connect({
            model: MODELS.LIVE,
            config: {
                systemInstruction: systemInstruction,
                responseModalities: [Modality.AUDIO],
                inputAudioTranscription: { model: 'gemini-3-flash-preview' },
                outputAudioTranscription: { model: 'gemini-3-flash-preview' },
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voiceName
                        }
                    }
                },
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 150,
                    candidateCount: 1
                }
            },
            callbacks: {
                onopen: () => {
                    console.log('Gemini Live session connected');
                },
                onmessage: async (msg: any) => {
                    await this.handleGeminiMessage(msg);
                },
                onclose: () => {
                    console.log('Gemini Live session closed');
                },
                onerror: (err: any) => {
                    console.error('Gemini Live error:', err);
                    this.sendError('Live session error');
                }
            }
        });
    }

    /**
     * Switch session to a new panelist
     */
    private async switchSession(panelist: Panelist, systemInstruction: string): Promise<void> {
        if (this.currentPanelistId === panelist.id) return;

        console.log(`Switching session to panelist: ${panelist.name} (${panelist.id})`);

        // Close existing session
        if (this.geminiSession) {
            // Send a brief pause signal?
            await this.geminiSession.close();
            this.geminiSession = null;
        }

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('API key not configured');
        const ai = new GoogleGenAI({ apiKey });

        // Short delay to ensure clean closure
        await new Promise(resolve => setTimeout(resolve, 500));

        this.currentPanelistId = panelist.id;
        await this.connectGeminiSession(ai, systemInstruction, panelist.voiceName || 'Kore');

        // Notify client of switch
        this.send({
            type: 'panelist_switched',
            data: { panelist }
        });
    }

    /**
     * Handle audio data from client
     */
    private async handleAudio(audioData: any): Promise<void> {
        if (!this.geminiSession) {
            console.warn('No active Gemini session');
            return;
        }

        try {
            await this.geminiSession.sendRealtimeInput({ media: audioData });
        } catch (error) {
            console.error('Error sending audio:', error);
        }
    }

    /**
     * Handle video frame from client
     */
    private async handleVideo(videoData: any): Promise<void> {
        if (!this.geminiSession) {
            console.warn('No active Gemini session');
            return;
        }

        try {
            await this.geminiSession.sendRealtimeInput({ media: videoData });
        } catch (error) {
            console.error('Error sending video:', error);
        }
    }

    /**
     * Handle messages from Gemini Live
     * OPTIMIZED FOR LOW LATENCY
     */
    private async handleGeminiMessage(message: any): Promise<void> {
        // OPTIMIZATION 1: Parallel processing - don't await unnecessarily
        const promises: Promise<void>[] = [];

        // Handle transcription (STREAMING - send immediately)
        if (message.serverContent?.outputTranscription) {
            const text = message.serverContent.outputTranscription.text;
            if (text && this.orchestrator) {
                // Extract speaker name
                const match = text.match(/^\[([^\]]+)\]:/);
                const panelistName = match ? match[1] : 'AI Panel';

                // OPTIMIZATION 2: Send transcription IMMEDIATELY (don't wait for storage)
                this.send({
                    type: 'transcription',
                    data: {
                        speaker: 'ai',
                        panelistName,
                        text,
                        timestamp: Date.now() // Add timestamp for client-side ordering
                    }
                });

                // OPTIMIZATION 3: Store in background (non-blocking)
                promises.push(
                    Promise.resolve().then(() => {
                        this.orchestrator!.addMessage({
                            id: Date.now().toString(),
                            speaker: 'ai',
                            panelistName,
                            text,
                            timestamp: Date.now()
                        });
                    })
                );

                // OPTIMIZATION 4: Prepare next question in background
                promises.push(this.prepareNextQuestion());
            }
        }

        // Handle input transcription (STREAMING)
        if (message.serverContent?.inputTranscription) {
            const text = message.serverContent.inputTranscription.text;
            if (text && this.orchestrator) {
                // OPTIMIZATION 5: Send immediately
                this.send({
                    type: 'transcription',
                    data: {
                        speaker: 'user',
                        text,
                        timestamp: Date.now()
                    }
                });

                // Store in background
                promises.push(
                    Promise.resolve().then(() => {
                        this.orchestrator!.addMessage({
                            id: Date.now().toString(),
                            speaker: 'user',
                            text,
                            timestamp: Date.now()
                        });
                    })
                );
            }
        }

        // OPTIMIZATION 6: Forward audio IMMEDIATELY (highest priority)
        const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            // Send audio first - don't wait for anything else
            this.send({
                type: 'audio',
                data: audioData
            });
        }

        // Handle interruptions (immediate)
        if (message.serverContent?.interrupted) {
            this.send({ type: 'interrupted' });
        }

        // OPTIMIZATION 7: Execute background tasks without blocking
        Promise.all(promises).catch(err => {
            console.error('Background task error:', err);
        });
    }

    /**
     * Prepare next question based on conversation flow
     */
    private async prepareNextQuestion(): Promise<void> {
        if (!this.orchestrator) return;

        try {
            const questionParams = await this.orchestrator.determineNextQuestion();
            const progress = this.orchestrator.getProgress();

            // Send progress update to client
            this.send({
                type: 'progress',
                data: {
                    currentPanelist: questionParams.panelist,
                    topic: questionParams.topic,
                    depth: questionParams.depth,
                    ...progress
                }
            });

            // Update Gemini system instruction for next question

            // Check if panelist changed
            if (questionParams.panelist.id !== this.currentPanelistId) {
                // Switch session to new panelist
                // Update instruction to reflect HANDOFF
                const handoffInstruction = `
You are now taking over the interview. 
${questionParams.systemInstruction}
Start by briefly acknowledging the previous speaker or topic, then ask your question.
                `.trim();

                await this.switchSession(questionParams.panelist, handoffInstruction);
            }
        } catch (error) {
            console.error('Error preparing next question:', error);
        }
    }

    /**
     * Handle pause request
     */
    private handlePause(): void {
        // In a full implementation, we'd pause the Gemini session
        this.send({ type: 'paused' });
    }

    /**
     * Handle resume request
     */
    private handleResume(): void {
        // In a full implementation, we'd resume the Gemini session
        this.send({ type: 'resumed' });
    }

    /**
     * Send message to client
     */
    private send(message: any): void {
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        }
    }

    /**
     * Send error to client
     */
    private sendError(message: string): void {
        this.send({
            type: 'error',
            data: { message }
        });
    }

    /**
     * Cleanup resources
     */
    private cleanup(): void {
        if (this.geminiSession) {
            // Close Gemini session if possible
            this.geminiSession = null;
        }
        this.orchestrator = null;
    }
}