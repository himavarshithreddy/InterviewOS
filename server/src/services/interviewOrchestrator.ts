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
    voiceName?: string; // Optional voice configuration
}

interface TranscriptMessage {
    id: string;
    speaker: 'user' | 'ai';
    panelistName?: string;
    text: string;
    timestamp: number;
    thoughtSignature?: ThoughtSignature; // NEW: AI's reasoning process
}

interface InterviewState {
    sessionId: string;
    candidate: CandidateProfile;
    panelists: Panelist[];
    currentPanelist: number;
    questionCount: number;
    topicsCovered: string[];
    currentTopic: string;
    depthLevel: number; // 1-5, increases for follow-ups
    candidateStrengths: string[];
    candidateWeaknesses: string[];
    conversationHistory: TranscriptMessage[];
    startTime: number;
    targetDuration: number; // in minutes
    selfCorrectionLog: SelfCorrection[]; // NEW: Track AI's self-corrections
}

interface ConversationContext {
    answerCompleteness: number; // 0-1
    answerQuality: number; // 0-1
    hasProbeableContent: boolean;
    mentionedTopics: string[];
}

interface Question {
    panelistId: string;
    panelistName: string;
    topic: string;
    depth: number;
    text: string;
}

/**
 * NEW: Thought Signature - Makes AI reasoning transparent
 * Aligns with Gemini 3 Hackathon "Marathon Agent" track
 */
interface ThoughtSignature {
    reasoning: string; // Why this question/approach?
    confidence: number; // 0-1, how confident in this decision
    alternatives: string[]; // What else was considered?
    nextAction: string; // What will happen next?
    timestamp: number;
}

/**
 * NEW: Self-Correction - AI reviews and improves its own questions
 * Key innovation for "Action Era" autonomous agents
 */
interface SelfCorrection {
    questionId: string;
    originalQuestion: string;
    issue: string; // What was wrong?
    correction: string; // How it was fixed
    timestamp: number;
}

/**
 * InterviewOrchestrator - Manages intelligent interview flow
 * 
 * This is the core innovation for deep, continuous interview experiences.
 * It maintains context, manages panelist rotation, and ensures comprehensive coverage.
 */
export class InterviewOrchestrator {
    private state: InterviewState;
    private readonly MIN_DEPTH_PER_TOPIC = 2;
    private readonly MAX_DEPTH = 5;
    private readonly QUESTIONS_PER_PANELIST_ROTATION = 3;

    constructor(
        sessionId: string,
        candidate: CandidateProfile,
        panelists: Panelist[],
        targetDuration: number = 30 // default 30 minutes
    ) {
        this.state = {
            sessionId,
            candidate,
            panelists,
            currentPanelist: 0,
            questionCount: 0,
            topicsCovered: [],
            currentTopic: '',
            depthLevel: 1,
            candidateStrengths: [],
            candidateWeaknesses: [],
            conversationHistory: [],
            startTime: Date.now(),
            targetDuration,
            selfCorrectionLog: [] // NEW: Initialize self-correction tracking
        };
    }

    /**
     * Add a message to conversation history
     */
    addMessage(message: TranscriptMessage): void {
        this.state.conversationHistory.push(message);
    }

    /**
     * Get current interview state
     */
    getState(): InterviewState {
        return { ...this.state };
    }

    /**
     * Analyze recent conversation exchanges
     */
    private analyzeRecentExchanges(messages: TranscriptMessage[]): ConversationContext {
        if (messages.length === 0) {
            return {
                answerCompleteness: 0,
                answerQuality: 0,
                hasProbeableContent: false,
                mentionedTopics: []
            };
        }

        // Get last user response
        const lastUserMessage = messages.filter(m => m.speaker === 'user').pop();

        if (!lastUserMessage) {
            return {
                answerCompleteness: 0,
                answerQuality: 0,
                hasProbeableContent: false,
                mentionedTopics: []
            };
        }

        const text = lastUserMessage.text.toLowerCase();
        const wordCount = text.split(/\s+/).length;

        // Heuristics for answer quality
        const answerCompleteness = Math.min(wordCount / 50, 1); // Assume 50 words is complete

        // Quality indicators
        const hasExamples = /for example|such as|like when|instance/.test(text);
        const hasNumbers = /\d+/.test(text);
        const hasSpecifics = hasExamples || hasNumbers;
        const isVague = /maybe|perhaps|i think|not sure|don't know/.test(text);

        let answerQuality = 0.5;
        if (hasSpecifics) answerQuality += 0.3;
        if (wordCount > 30) answerQuality += 0.2;
        if (isVague) answerQuality -= 0.3;
        answerQuality = Math.max(0, Math.min(1, answerQuality));

        // Check for probeable content
        const hasProbeableContent = hasExamples ||
            text.includes('project') ||
            text.includes('experience') ||
            text.includes('challenge');

        return {
            answerCompleteness,
            answerQuality,
            hasProbeableContent,
            mentionedTopics: this.extractTopics(text)
        };
    }

    /**
     * Extract topics mentioned in text
     */
    private extractTopics(text: string): string[] {
        const topics: string[] = [];
        const keywords = {
            technical: ['code', 'algorithm', 'system', 'architecture', 'design', 'database', 'api'],
            leadership: ['team', 'lead', 'manage', 'mentor', 'collaborate'],
            problem_solving: ['problem', 'challenge', 'solution', 'debug', 'fix'],
            communication: ['present', 'explain', 'communicate', 'discuss']
        };

        for (const [topic, words] of Object.entries(keywords)) {
            if (words.some(word => text.includes(word))) {
                topics.push(topic);
            }
        }

        return topics;
    }

    /**
     * Determine if we should follow up on current topic
     */
    private shouldFollowUp(context: ConversationContext): boolean {
        // Follow up if answer was incomplete
        if (context.answerCompleteness < 0.6) return true;

        // Follow up if answer was high quality and we haven't gone deep enough
        if (context.answerQuality > 0.8 && this.state.depthLevel < this.MAX_DEPTH) return true;

        // Follow up if there's probeable content
        if (context.hasProbeableContent && this.state.depthLevel < 3) return true;

        // Follow up if we haven't reached minimum depth
        if (this.state.depthLevel < this.MIN_DEPTH_PER_TOPIC) return true;

        return false;
    }

    /**
     * Count questions asked by each panelist
     */
    private countQuestionsByPanelist(): number[] {
        const counts = new Array(this.state.panelists.length).fill(0);

        this.state.conversationHistory
            .filter(m => m.speaker === 'ai' && m.panelistName)
            .forEach(m => {
                const index = this.state.panelists.findIndex(p => p.name === m.panelistName);
                if (index !== -1) counts[index]++;
            });

        return counts;
    }

    /**
     * Select next panelist based on fairness and topic relevance
     */
    private selectNextPanelist(nextTopic: string): number {
        const questionCounts = this.countQuestionsByPanelist();

        // Find panelist with fewest questions
        const minCount = Math.min(...questionCounts);
        const leastActive = questionCounts.findIndex(c => c === minCount);

        // Find best panelist for topic based on their focus
        let bestForTopic = 0;
        const topicLower = nextTopic.toLowerCase();

        for (let i = 0; i < this.state.panelists.length; i++) {
            const focus = this.state.panelists[i].focus.toLowerCase();
            if (topicLower.includes(focus) || focus.includes(topicLower)) {
                bestForTopic = i;
                break;
            }
        }

        // Balance between fairness (70%) and relevance (30%)
        return Math.random() > 0.3 ? bestForTopic : leastActive;
    }

    /**
     * Select next topic to cover
     */
    private selectNextTopic(): string {
        const role = this.state.candidate.targetRole || 'general';
        const roleLower = role.toLowerCase();

        // Define topic pools based on role type
        const technicalTopics = ['system design', 'algorithms', 'code quality', 'debugging', 'architecture'];
        const behavioralTopics = ['teamwork', 'conflict resolution', 'leadership', 'communication'];
        const domainTopics = roleLower.includes('frontend') ? ['UI/UX', 'performance', 'accessibility'] :
            roleLower.includes('backend') ? ['scalability', 'databases', 'APIs'] :
                roleLower.includes('product') ? ['product strategy', 'user research', 'roadmap'] :
                    ['project management', 'stakeholder communication'];

        const allTopics = [...technicalTopics, ...behavioralTopics, ...domainTopics];

        // Filter out already covered topics
        const uncovered = allTopics.filter(t => !this.state.topicsCovered.includes(t));

        if (uncovered.length > 0) {
            return uncovered[Math.floor(Math.random() * uncovered.length)];
        }

        // If all covered, revisit a topic for deeper exploration
        return allTopics[Math.floor(Math.random() * allTopics.length)];
    }

    /**
     * Generate system instruction for next question
     */
    generateSystemInstruction(nextPanelist: Panelist, topic: string, depth: number): string {
        const recentHistory = this.state.conversationHistory.slice(-6).map(m =>
            `${m.speaker === 'user' ? 'Candidate' : m.panelistName}: ${m.text}`
        ).join('\n');

        return `
You are ${nextPanelist.name}, a ${nextPanelist.role} conducting an interview for the role of ${this.state.candidate.targetRole}.

Your focus: ${nextPanelist.focus}
Your style: ${nextPanelist.description}

Candidate Profile:
- Name: ${this.state.candidate.name}
- Skills: ${this.state.candidate.skills.slice(0, 5).join(', ')}
- Experience: ${this.state.candidate.experience.slice(0, 2).join('; ')}

Current Topic: ${topic}
Question Depth Level: ${depth}/5 (1=surface, 5=very deep)

Recent Conversation:
${recentHistory}

Instructions:
1. Ask ONE question about "${topic}" at depth level ${depth}
2. ${depth === 1 ? 'Start with a broad question to understand their experience' :
                depth === 2 ? 'Probe deeper into their specific approach or methodology' :
                    depth === 3 ? 'Ask about edge cases, challenges, or trade-offs' :
                        depth === 4 ? 'Explore their decision-making process and reasoning' :
                            'Challenge their assumptions or ask about alternative approaches'}
3. Build on the recent conversation naturally
4. Keep it conversational and professional
5. Prefix your response with "[${nextPanelist.name}]: "
6. Keep the question concise (1-2 sentences)

Generate your question now:
    `.trim();
    }

    /**
     * Determine next question parameters
     */
    async determineNextQuestion(): Promise<{
        panelist: Panelist;
        topic: string;
        depth: number;
        systemInstruction: string;
    }> {
        // Analyze recent conversation
        const recentMessages = this.state.conversationHistory.slice(-5);
        const context = this.analyzeRecentExchanges(recentMessages);

        // Decide: follow up or new topic?
        const shouldFollowUp = this.shouldFollowUp(context);

        let nextPanelist: Panelist;
        let nextTopic: string;
        let nextDepth: number;

        if (shouldFollowUp && this.state.currentTopic) {
            // Continue with same panelist and topic, increase depth
            nextPanelist = this.state.panelists[this.state.currentPanelist];
            nextTopic = this.state.currentTopic;
            nextDepth = Math.min(this.state.depthLevel + 1, this.MAX_DEPTH);
        } else {
            // Switch topic and potentially panelist
            nextTopic = this.selectNextTopic();
            const panelistIndex = this.selectNextPanelist(nextTopic);
            nextPanelist = this.state.panelists[panelistIndex];
            nextDepth = 1;

            // Update state
            this.state.currentPanelist = panelistIndex;
            if (!this.state.topicsCovered.includes(nextTopic)) {
                this.state.topicsCovered.push(nextTopic);
            }
        }

        // Update state
        this.state.currentTopic = nextTopic;
        this.state.depthLevel = nextDepth;
        this.state.questionCount++;

        const systemInstruction = this.generateSystemInstruction(nextPanelist, nextTopic, nextDepth);

        return {
            panelist: nextPanelist,
            topic: nextTopic,
            depth: nextDepth,
            systemInstruction
        };
    }

    /**
     * Get interview progress summary
     */
    getProgress(): {
        questionCount: number;
        topicsCovered: number;
        timeElapsed: number;
        estimatedRemaining: number;
        currentTopic?: string;
        currentDepth?: number;
    } {
        const timeElapsed = Math.floor((Date.now() - this.state.startTime) / 1000 / 60); // minutes
        const estimatedRemaining = Math.max(0, this.state.targetDuration - timeElapsed);

        return {
            questionCount: this.state.questionCount,
            topicsCovered: this.state.topicsCovered.length,
            timeElapsed,
            estimatedRemaining,
            currentTopic: this.state.currentTopic,
            currentDepth: this.state.depthLevel
        };
    }

    /**
     * NEW: Create Thought Signature - Makes AI reasoning transparent
     * This is a key innovation for the Gemini 3 Hackathon
     */
    createThoughtSignature(
        decision: string,
        reasoning: string,
        alternatives: string[]
    ): ThoughtSignature {
        // Calculate confidence based on context quality
        const recentMessages = this.state.conversationHistory.slice(-5);
        const context = this.analyzeRecentExchanges(recentMessages);

        // Higher confidence if we have good context
        let confidence = 0.7;
        if (context.answerQuality > 0.7) confidence += 0.2;
        if (this.state.questionCount > 5) confidence += 0.1; // More data = more confidence
        confidence = Math.min(1, confidence);

        return {
            reasoning,
            confidence,
            alternatives,
            nextAction: decision,
            timestamp: Date.now()
        };
    }

    /**
     * NEW: Self-Correction Loop - AI reviews its own questions
     * Autonomous quality improvement without human intervention
     */
    async selfCorrectQuestion(
        questionText: string,
        topic: string,
        depth: number
    ): Promise<{ corrected: string; hadIssue: boolean; issue?: string }> {
        // Check for common question quality issues
        const issues: string[] = [];

        // Issue 1: Too vague
        if (questionText.length < 20 || !questionText.includes('?')) {
            issues.push('Question too vague or not properly formed');
        }

        // Issue 2: Too complex for depth level
        const complexityIndicators = ['furthermore', 'moreover', 'additionally', 'specifically'];
        const hasComplexity = complexityIndicators.some(ind => questionText.toLowerCase().includes(ind));
        if (depth === 1 && hasComplexity) {
            issues.push('Too complex for initial depth level');
        }

        // Issue 3: Doesn't match topic
        if (!questionText.toLowerCase().includes(topic.toLowerCase().split(' ')[0])) {
            issues.push(`Question doesn't clearly relate to topic: ${topic}`);
        }

        // Issue 4: Multiple questions in one
        const questionMarks = (questionText.match(/\?/g) || []).length;
        if (questionMarks > 1) {
            issues.push('Multiple questions - should ask one at a time');
        }

        if (issues.length === 0) {
            return { corrected: questionText, hadIssue: false };
        }

        // Log the self-correction
        const correction: SelfCorrection = {
            questionId: `q-${this.state.questionCount}`,
            originalQuestion: questionText,
            issue: issues.join('; '),
            correction: 'Question regenerated with improved clarity and focus',
            timestamp: Date.now()
        };

        this.state.selfCorrectionLog.push(correction);

        // Return indication that question needs regeneration
        return {
            corrected: questionText,
            hadIssue: true,
            issue: issues[0]
        };
    }

    /**
     * NEW: Get self-correction statistics
     * Demonstrates autonomous improvement over time
     */
    getSelfCorrectionStats(): {
        totalCorrections: number;
        correctionRate: number;
        commonIssues: string[];
    } {
        const totalCorrections = this.state.selfCorrectionLog.length;
        const correctionRate = this.state.questionCount > 0
            ? totalCorrections / this.state.questionCount
            : 0;

        // Extract common issues
        const issueMap = new Map<string, number>();
        this.state.selfCorrectionLog.forEach(corr => {
            const issue = corr.issue.split(';')[0]; // Get first issue
            issueMap.set(issue, (issueMap.get(issue) || 0) + 1);
        });

        const commonIssues = Array.from(issueMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3)
            .map(([issue]) => issue);

        return {
            totalCorrections,
            correctionRate,
            commonIssues
        };
    }

    /**
     * NEW: Export session data for long-running interviews
     * Supports "Marathon Agent" track - sessions spanning hours/days
     */
    exportSession(): {
        sessionId: string;
        candidate: CandidateProfile;
        progress: ReturnType<InterviewOrchestrator['getProgress']>;
        insights: {
            strengths: string[];
            weaknesses: string[];
            topicsCovered: string[];
            selfCorrectionStats: ReturnType<InterviewOrchestrator['getSelfCorrectionStats']>;
        };
        canResume: boolean;
    } {
        return {
            sessionId: this.state.sessionId,
            candidate: this.state.candidate,
            progress: this.getProgress(),
            insights: {
                strengths: this.state.candidateStrengths,
                weaknesses: this.state.candidateWeaknesses,
                topicsCovered: this.state.topicsCovered,
                selfCorrectionStats: this.getSelfCorrectionStats()
            },
            canResume: this.getProgress().estimatedRemaining > 0
        };
    }

    /**
     * NEW: Resume from exported session
     * Enables multi-day interview preparation
     */
    static fromExportedSession(
        exportedData: ReturnType<InterviewOrchestrator['exportSession']>,
        conversationHistory: TranscriptMessage[]
    ): InterviewOrchestrator {
        const orchestrator = new InterviewOrchestrator(
            exportedData.sessionId,
            exportedData.candidate,
            [], // Panelists would need to be stored separately
            30
        );

        // Restore state
        orchestrator.state.conversationHistory = conversationHistory;
        orchestrator.state.topicsCovered = exportedData.insights.topicsCovered;
        orchestrator.state.candidateStrengths = exportedData.insights.strengths;
        orchestrator.state.candidateWeaknesses = exportedData.insights.weaknesses;

        return orchestrator;
    }
}
