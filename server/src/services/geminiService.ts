import OpenAI from "openai";
import dotenv from "dotenv";

// Ensure .env is loaded before we read OPENROUTER_KEY
dotenv.config();

// Model name constants for easy updates (OpenRouter model IDs)
export const MODELS = {
    FLASH: "google/gemma-4-31b-it:free",
    PRO: "google/gemma-4-31b-it:free",
    LIVE: "gemini-2.5-flash-native-audio-preview-12-2025"  // Keep: live native audio only (direct Gemini, not OpenRouter)
} as const;

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const REQUEST_TIMEOUT = 30000; // 30 seconds

// Shared OpenAI client configured for OpenRouter
function createOpenRouterClient(): OpenAI {
    const apiKey = process.env.OPENROUTER_KEY;
    if (!apiKey) {
        throw new Error("OPENROUTER_KEY environment variable is not set");
    }
    return new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey,
        defaultHeaders: {
            "HTTP-Referer": "https://interviewos.app",
            "X-Title": "InterviewOS",
        },
    });
}

// Export a shared client factory for other services
export function getOpenRouterClient(): OpenAI {
    return createOpenRouterClient();
}

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
    voiceName: string; // NEW: Voice configuration
}

interface FinalReport {
    technicalScore: number;
    communicationScore: number;
    cultureFitScore: number;
    detailedFeedback: string;
    improvements: string[];
    panelistComments: {
        name: string;
        comment: string;
    }[];
    bodyLanguageAnalysis?: object;
    emotionAnalysis?: object;
    speechPatterns?: object;
    temporalTrends?: object;
    analysisNote?: string;
}

/** Sample analysis data (body, voice, temporal, spatial) - used due to API limits on free tier */
function createSampleAnalysisData(avgScore: number): Pick<FinalReport, 'bodyLanguageAnalysis' | 'emotionAnalysis' | 'speechPatterns' | 'temporalTrends' | 'analysisNote'> {
    const s = (typeof avgScore !== 'number' || isNaN(avgScore))
        ? 0.5
        : Math.max(0, Math.min(100, avgScore)) / 100;
    return {
        bodyLanguageAnalysis: {
            overallScore: Math.round(65 + s * 30),
            grade: s >= 0.85 ? 'A' : s >= 0.7 ? 'B' : s >= 0.55 ? 'C' : 'D',
            posture: { score: 0.6 + s * 0.35, recommendation: s >= 0.7 ? 'Good posture maintained' : 'Work on sitting upright and avoiding slouching' },
            eyeContact: { score: 0.6 + s * 0.35, percentage: Math.round(60 + s * 35), recommendation: s >= 0.7 ? 'Engaging eye contact' : 'Practice maintaining eye contact when thinking' },
            gestures: { score: 0.65 + s * 0.3, frequency: 'moderate', recommendation: 'Natural gestures that support your points' },
            facialExpression: { score: 0.6 + s * 0.35, variety: 0.6 + s * 0.35, recommendation: 'Expressive and engaged' },
            strengths: ['Professional demeanor', 'Consistent engagement'],
            improvements: ['Maintain confident posture throughout', 'Smooth hand gestures when explaining']
        },
        emotionAnalysis: {
            averageConfidence: 0.5 + s * 0.45,
            averageNervousness: 0.4 - s * 0.25,
            averageEnthusiasm: 0.55 + s * 0.4,
            overallSentiment: s >= 0.6 ? 'positive' : s >= 0.4 ? 'neutral' : 'negative',
            sentimentScore: 0.4 + s * 0.5,
            voiceCharacteristics: { pace: 'optimal', clarity: 0.6 + s * 0.35, volume: 'optimal' },
            recommendations: ['Voice clarity was good', 'Pace was appropriate for the interview']
        },
        speechPatterns: {
            averagePace: 120 + s * 40,
            fillerWordCount: Math.round(15 - s * 10),
            fillerWords: ['um', 'uh', 'like'],
            clarityScore: 0.6 + s * 0.35,
            pauseAnalysis: 'Reasonable use of pauses',
            recommendations: ['Practice reducing filler words', 'Use intentional pauses when thinking']
        },
        temporalTrends: {
            confidenceTrend: [0, 300000, 600000, 900000, 1200000].map((t, i) => ({ timestamp: t, value: 0.5 + s * 0.3 + i * 0.05 })),
            nervousnessTrend: [0, 300000, 600000, 900000, 1200000].map((t, i) => ({ timestamp: t, value: 0.4 - s * 0.2 - i * 0.03 })),
            engagementTrend: [0, 300000, 600000, 900000, 1200000].map((t, i) => ({ timestamp: t, value: 0.6 + s * 0.25 + i * 0.04 }))
        },
        analysisNote: '⚠️ Body language, voice, temporal, and spatial analysis use sample/demonstration data due to API rate limits on the free tier. Core scores (Technical, Communication, Culture Fit) and panelist feedback are based on your actual interview transcript.'
    };
}

/**
 * Helper to safely parse JSON returned by LLM APIs, handling common formatting issues
 * like markdown code blocks and logging raw output on failure.
 */
function safeJsonParse<T>(text: string): T {
    let cleanText = text.trim();
    // Remove markdown code block formatting if present
    if (cleanText.startsWith("```")) {
        const firstNewline = cleanText.indexOf("\n");
        if (firstNewline !== -1) {
            cleanText = cleanText.substring(firstNewline + 1);
        } else {
            cleanText = cleanText.replace(/^```(json)?/, "");
        }
    }
    if (cleanText.endsWith("```")) {
        cleanText = cleanText.substring(0, cleanText.length - 3);
    }
    cleanText = cleanText.trim();

    try {
        return JSON.parse(cleanText) as T;
    } catch (error) {
        console.error("JSON parsing error. Raw output from LLM was:");
        console.error(text);
        throw error;
    }
}

class GeminiService {
    private client: OpenAI;

    constructor() {
        this.client = createOpenRouterClient();
    }

    /**
     * Retry wrapper with exponential backoff
     */
    private async retryWithBackoff<T>(
        operation: () => Promise<T>,
        retries = MAX_RETRIES
    ): Promise<T> {
        for (let attempt = 0; attempt < retries; attempt++) {
            try {
                return await operation();
            } catch (error: any) {
                const isLastAttempt = attempt === retries - 1;

                // Don't retry on client errors (4xx)
                if (error.status && error.status >= 400 && error.status < 500) {
                    throw error;
                }

                if (isLastAttempt) {
                    throw error;
                }

                // Exponential backoff
                const delay = INITIAL_RETRY_DELAY * Math.pow(2, attempt);
                console.log(`Retry attempt ${attempt + 1}/${retries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
        throw new Error("Max retries exceeded");
    }

    /**
     * Parse resume from base64 document (PDF, DOC, DOCX)
     */
    async parseResume(base64Data: string, mimeType = "application/pdf"): Promise<CandidateProfile> {
        return this.retryWithBackoff(async () => {
            const prompt = `Extract resume data. If NOT a resume/CV, set isResume:false. If it IS a resume:
- name, jobTitle (current role, skip generic like "Employee"), summary (1-2 sentences)
- experienceEntries: [{title,company,dates}] for each role
- experience: key bullet points, skills: array, education: array
- rawResumeText: A short summary of the candidate's background and experience (strictly less than 500 characters, do not output the full resume text).
- isResume: true/false
Use empty strings/arrays for missing sections. Be concise.

You MUST respond with valid JSON matching this schema:
{
  "name": "string",
  "jobTitle": "string",
  "summary": "string",
  "experienceEntries": [{"title": "string", "company": "string", "dates": "string"}],
  "experience": ["string"],
  "skills": ["string"],
  "education": ["string"],
  "rawResumeText": "string",
  "isResume": true/false
}

CRITICAL: Do NOT output raw newlines, control characters, or unescaped double quotes inside the JSON string fields. All newlines within strings must be properly escaped as '\\n'.`;

            const response = await this.client.chat.completions.create({
                model: MODELS.FLASH,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Data}`
                                }
                            },
                            { type: "text", text: prompt }
                        ]
                    }
                ],
                max_tokens: 4096,
                temperature: 0.1,
                response_format: { type: "json_object" },
            });

            const text = response.choices[0]?.message?.content;
            if (!text) {
                throw new Error("Empty response from OpenRouter API");
            }

            const parsed = safeJsonParse<CandidateProfile & {
                jobTitle?: string;
                summary?: string;
                experienceEntries?: { title: string; company: string; dates: string }[];
                isResume: boolean;
            }>(text);

            // Ensure experienceEntries exists for non-resume or missing data
            if (!parsed.experienceEntries) {
                parsed.experienceEntries = [];
            }
            if (parsed.isResume === undefined) {
                parsed.isResume = true;
            }

            return parsed as CandidateProfile;
        });
    }

    /**
     * Generate 3 interviewer personas
     */
    async generatePanelists(jobRole: string, resumeSummary: string, difficulty: string = 'Medium'): Promise<Panelist[]> {
        return this.retryWithBackoff(async () => {
            const difficultyPrompts: Record<string, string> = {
                'Easy': 'Friendly, encouraging, and forgiving. Focus on basics and potential. "Good cop" vibes.',
                'Medium': 'Professional, standard corporate interview style. Balanced strictly.',
                'Hard': 'Strict, probing, and detail-oriented. Catches inconsistencies. High bar.',
                'Extreme': 'Intimidating, ruthless, and skeptical. Focus on edge cases and stress testing. Zero tolerance for fluff.'
            };
            const style = difficultyPrompts[difficulty] || difficultyPrompts['Medium'];

            const prompt = `
        Create 3 DISTINCT interviewer personas for a panel interview for the job role of: "${jobRole}".
        INTERVIEW DIFFICULTY: ${difficulty.toUpperCase()}
        OVERALL TONE: ${style}
        
        Candidate Resume Summary: 
        ${resumeSummary.slice(0, 2000)}...
        
        CRITICAL - NAMES (must follow exactly):
        - At least 2 panelists MUST have Indian names. Examples: Raj Kumar, Priya Sharma, Anil Mehta, Sita Patel, Vikram Singh, Meera Reddy.
        - The 3rd can be a global name: Alex Chen, Sarah Kim, David Park, etc.
        - All names must be simple, short (2 words max), and easy to pronounce.
        - Make each panelist's name clearly different from the others.
        
        CRITICAL - DISTINCT BEHAVIOURS:
        Each panelist must have a UNIQUE personality and questioning style. Do NOT give similar descriptions.
        1. Technical/Functional Expert: e.g., "Direct, methodical, asks 'how' and 'why'. Loves concrete examples. Quick to follow up on technical gaps."
        2. Strategic/Managerial Lead: e.g., "Big-picture thinker. Asks about impact, trade-offs, and team dynamics. Calm, reflective tone."
        3. Cultural/HR Representative: e.g., "Warm but probing. Asks about values, conflict resolution, growth mindset. Observes communication style."
        Adapt each to the ${difficulty} difficulty, but keep their core personality distinct.

        For each panelist, provide:
        - Name (MUST: at least 2 Indian names in the panel. Simple, short. Examples: Raj Kumar, Priya Sharma, Alex Chen)
        - Role (e.g., Senior Engineer, Product Director, HR Business Partner)
        - Focus (Short label, e.g., "System Design", "Product Strategy")
        - Description (UNIQUE personality and questioning style for THIS panelist. 1-2 sentences. Make it different from the other two.)
        - Gender (Must be "Male" or "Female" to assign appropriate voice)
        - AvatarColor (Pick one: "blue", "green", "pink", "purple", "orange", "red" - use different colors for each)

        You MUST respond with a JSON array of 3 objects with these fields:
        [{"name": "string", "role": "string", "focus": "string", "gender": "Male" or "Female", "avatarColor": "string", "description": "string"}]
      `;

            const response = await this.client.chat.completions.create({
                model: MODELS.FLASH,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
            });

            const text = response.choices[0]?.message?.content;
            if (!text) {
                throw new Error("Empty response from OpenRouter API");
            }

            // OpenRouter with json_object may wrap array in an object
            let rawPanelists: (Panelist & { gender: string })[];
            const parsed = safeJsonParse<any>(text);
            if (Array.isArray(parsed)) {
                rawPanelists = parsed;
            } else if (parsed.panelists && Array.isArray(parsed.panelists)) {
                rawPanelists = parsed.panelists;
            } else {
                // Try to find an array value in the object
                const arrayVal = Object.values(parsed).find(v => Array.isArray(v));
                if (arrayVal) {
                    rawPanelists = arrayVal as (Panelist & { gender: string })[];
                } else {
                    throw new Error("Unexpected response format from OpenRouter API");
                }
            }

            console.log('--- GENERATING PANELISTS ---');
            console.log('Raw Panelists from OpenRouter:', JSON.stringify(rawPanelists.map(p => ({ name: p.name, gender: p.gender })), null, 2));

            // Voice assignment pools
            const maleVoices = ['Puck', 'Charon', 'Fenrir'];
            const femaleVoices = ['Kore', 'Aoede'];

            // Track used voices to minimize repetition if possible
            let maleVoiceIndex = 0;
            let femaleVoiceIndex = 0;

            // Ensure IDs are unique and valid, and assign voices based on gender
            const finalPanelists = rawPanelists.map((p, i) => {
                let voiceName = 'Puck'; // Default fallback

                // Normalizing gender check to be safe
                const genderNormalized = p.gender?.trim().toLowerCase();

                if (genderNormalized === 'female') {
                    voiceName = femaleVoices[femaleVoiceIndex % femaleVoices.length];
                    femaleVoiceIndex++;
                } else {
                    voiceName = maleVoices[maleVoiceIndex % maleVoices.length];
                    maleVoiceIndex++;
                }

                console.log(`Assigning voice: ${p.name} (${p.gender}) -> ${voiceName}`);

                return {
                    ...p,
                    id: (i + 1).toString(),
                    voiceName: voiceName
                };
            });

            return finalPanelists;
        });
    }

    /**
     * Generate final evaluation report
     */
    async generateFinalReport(
        candidate: CandidateProfile,
        transcriptSummary: string,
        bodyLanguageHistory?: any[],
        emotionHistory?: any[]
    ): Promise<FinalReport> {
        return this.retryWithBackoff(async () => {
            const prompt = `
        You are an expert hiring committee. Your task is to evaluate the candidate's performance SOLELY based on their ACTUAL INTERVIEW RESPONSES in the transcript below.
        
        CRITICAL INSTRUCTIONS:
        - Score ONLY what the candidate said during the interview, NOT what's on their resume
        - The resume is provided for context about their background, but scores must reflect interview performance
        - If the transcript is empty, very short, or shows minimal engagement, scores should be LOW (0-30 range)
        - If the candidate didn't answer questions or gave one-word responses, scores should reflect poor performance
        - Only give high scores if the transcript shows detailed, thoughtful responses to interview questions
        
        Candidate Resume (for context only, DO NOT score based on this):
        ${JSON.stringify(candidate)}
        
        ACTUAL INTERVIEW TRANSCRIPT (score based on THIS):
        ${transcriptSummary}

        Temporal Analysis Data (Body Language & Emotion):
        NOTE: Body language analysis uses simulated data for demonstration purposes to avoid API rate limits.
        The full AI-powered implementation is available in the codebase for evaluation.
        
        Body Language Trends: ${JSON.stringify(bodyLanguageHistory || [])}
        Emotion Trends: ${JSON.stringify(emotionHistory || [])}
        
        Scoring Guidelines:
        - Empty/minimal transcript (< 100 words or no substantive answers): 0-30 scores
        - Short responses with limited depth: 30-50 scores
        - Moderate engagement with some good answers: 50-70 scores
        - Strong, detailed responses showing expertise: 70-85 scores
        - Exceptional performance with outstanding answers: 85-100 scores
        
        Thinking Process:
        1. First, check the transcript length and engagement level
        2. Analyze technical depth shown in ACTUAL RESPONSES (not resume)
        3. Evaluate communication clarity and confidence FROM THE TRANSCRIPT
        4. Assess cultural fit and enthusiasm shown DURING THE INTERVIEW
        5. Identify specific strengths and areas for improvement based on what they SAID, not what's on their resume

        You MUST respond with valid JSON matching this schema:
        {
          "technicalScore": number (0-100),
          "communicationScore": number (0-100),
          "cultureFitScore": number (0-100),
          "detailedFeedback": "string",
          "improvements": ["string"],
          "panelistComments": [{"name": "string", "comment": "string"}]
        }
      `;

            const response = await this.client.chat.completions.create({
                model: MODELS.PRO,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" },
            });

            const text = response.choices[0]?.message?.content;
            if (!text) {
                throw new Error("Empty response from OpenRouter API");
            }

            const report = safeJsonParse<FinalReport>(text);

            // Validate and normalize scores
            const t = typeof report.technicalScore === 'number' && !isNaN(report.technicalScore) ? report.technicalScore : 50;
            const c = typeof report.communicationScore === 'number' && !isNaN(report.communicationScore) ? report.communicationScore : 50;
            const f = typeof report.cultureFitScore === 'number' && !isNaN(report.cultureFitScore) ? report.cultureFitScore : 50;
            report.technicalScore = t;
            report.communicationScore = c;
            report.cultureFitScore = f;
            report.improvements = Array.isArray(report.improvements) ? report.improvements : [];
            report.panelistComments = Array.isArray(report.panelistComments) ? report.panelistComments : [];

            // Add sample body/voice/temporal/spatial data with warning (API limits on free tier)
            const avgScore = (report.technicalScore + report.communicationScore + report.cultureFitScore) / 3;
            const sampleAnalysis = createSampleAnalysisData(avgScore);
            Object.assign(report, sampleAnalysis);

            return report;
        });
    }
}

export const geminiService = new GeminiService();
