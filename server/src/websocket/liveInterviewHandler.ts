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
        } catch (error: any) {
            console.error('Failed to initialize orchestrator:', error);
            this.sendError('Failed to initialize orchestration service');
        }
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
        this.orchestrator = null;
        console.log(`Session ${this.sessionId} cleaned up`);
    }
}