import { WebSocket } from 'ws';
import { InterviewOrchestrator } from '../services/interviewOrchestrator.js';

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

interface TranscriptMessage {
    speaker: 'user' | 'ai';
    text: string;
    timestamp: number;
    panelistName?: string;
}

interface OrchestrationHint {
    suggestedTopic: string;
    suggestedDepth: number;
    shouldFollowUp: boolean;
    reasoning: string;
    confidence: number;
    suggestedPanelistIndex?: number;
}

/**
 * Handle WebSocket connections for orchestration sidecar
 * Client handles direct Gemini connection, server provides strategic hints
 */
export class LiveInterviewHandler {
    private ws: WebSocket;
    private orchestrator: InterviewOrchestrator | null = null;
    private sessionId: string;
    private timeCheckInterval: NodeJS.Timeout | null = null;
    private lastPhase: string | null = null;

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

        this.ws.on('close', async () => {
            await this.cleanup();
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
            case 'transcript_update':
                await this.handleTranscriptUpdate(message.data);
                break;
            default:
                console.warn('Unknown message type:', message.type);
        }
    }

    /**
     * Initialize orchestrator (no Gemini session - client handles that)
     */
    private async initializeSession(data: SessionData): Promise<void> {
        if (this.orchestrator) {
            console.log('Session already active, cleaning up before re-initializing');
            await this.cleanup();
        }

        try {
            const { candidate, panelists } = data;

            // Create orchestrator for strategic analysis
            this.orchestrator = new InterviewOrchestrator(
                this.sessionId,
                candidate,
                panelists,
                30 // 30 minute interview
            );

            console.log(`Orchestrator initialized for session: ${this.sessionId}`);
            this.send({ type: 'initialized', data: { sessionId: this.sessionId } });

            // Start periodic time checking (every 10 seconds)
            this.startTimeChecking();
        } catch (error: any) {
            console.error('Failed to initialize orchestrator:', error);
            this.sendError('Failed to initialize orchestration service');
        }
    }

    /**
     * NEW: Start periodic time checking for phase transitions
     */
    private startTimeChecking(): void {
        // Clear any existing interval
        if (this.timeCheckInterval) {
            clearInterval(this.timeCheckInterval);
        }

        // Check time every 10 seconds
        this.timeCheckInterval = setInterval(() => {
            this.checkInterviewProgress();
        }, 10000);

        // Also do an immediate check
        this.checkInterviewProgress();
    }

    /**
     * NEW: Check interview progress and emit events
     */
    private checkInterviewProgress(): void {
        if (!this.orchestrator) return;

        const phase = this.orchestrator.getInterviewPhase();
        const remainingSeconds = this.orchestrator.getRemainingTime();

        // Check for phase transitions
        if (this.orchestrator.shouldStartClosing()) {
            this.orchestrator.startClosingPhase();
            this.send({
                type: 'interview_phase_change',
                data: {
                    phase: 'closing',
                    remainingSeconds,
                    shouldStartClosing: true
                }
            });
            console.log(`Interview entering closing phase: ${remainingSeconds}s remaining`);
        } else if (this.orchestrator.shouldComplete()) {
            this.orchestrator.completeInterview();
            const progress = this.orchestrator.getProgress();
            this.send({
                type: 'interview_complete',
                data: {
                    totalDuration: progress.timeElapsed,
                    questionCount: progress.questionCount,
                    topicsCovered: this.orchestrator.getState().topicsCovered
                }
            });
            console.log('Interview completed');

            // Stop time checking
            if (this.timeCheckInterval) {
                clearInterval(this.timeCheckInterval);
                this.timeCheckInterval = null;
            }
        }

        // Send time updates
        this.send({
            type: 'time_update',
            data: {
                remainingSeconds,
                phase
            }
        });
    }

    /**
     * Handle transcript updates from client and provide orchestration hints
     */
    private async handleTranscriptUpdate(data: TranscriptMessage): Promise<void> {
        if (!this.orchestrator) {
            console.warn('No active orchestrator');
            return;
        }

        try {
            // Add message to orchestrator's history
            this.orchestrator.addMessage({
                id: Date.now().toString(),
                speaker: data.speaker,
                panelistName: data.panelistName,
                text: data.text,
                timestamp: data.timestamp
            });

            // Only generate hints after user responses (not after AI questions)
            if (data.speaker === 'user') {
                const hint = await this.generateOrchestrationHint();

                // Send hint back to client
                this.send({
                    type: 'orchestration_hint',
                    data: hint
                });

                console.log(`Orchestration hint sent: topic="${hint.suggestedTopic}", depth=${hint.suggestedDepth}, followUp=${hint.shouldFollowUp}`);
            }
        } catch (error) {
            console.error('Error processing transcript update:', error);
        }
    }

    /**
     * Generate orchestration hint based on current interview state
     */
    private async generateOrchestrationHint(): Promise<OrchestrationHint> {
        if (!this.orchestrator) {
            throw new Error('Orchestrator not initialized');
        }

        // Use orchestrator's sophisticated logic to determine next question
        const questionParams = await this.orchestrator.determineNextQuestion();
        const progress = this.orchestrator.getProgress();

        // Find panelist index
        const state = this.orchestrator.getState();
        const panelistIndex = state.panelists.findIndex(p => p.id === questionParams.panelist.id);

        return {
            suggestedTopic: questionParams.topic,
            suggestedDepth: questionParams.depth,
            shouldFollowUp: questionParams.depth > 1,
            reasoning: `Based on ${progress.questionCount} questions covering ${progress.topicsCovered} topics. Current depth: ${questionParams.depth}/5`,
            confidence: 0.85, // Could be enhanced with actual confidence calculation
            suggestedPanelistIndex: panelistIndex >= 0 ? panelistIndex : undefined
        };
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
    private async cleanup(): Promise<void> {
        // Clear time check interval
        if (this.timeCheckInterval) {
            clearInterval(this.timeCheckInterval);
            this.timeCheckInterval = null;
        }

        this.orchestrator = null;
        console.log(`Session ${this.sessionId} cleaned up`);
    }
}