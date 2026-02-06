import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

// Ensure .env is loaded before we read GEMINI_API_KEY
dotenv.config();

// Model name constants for easy updates
export const MODELS = {
    FLASH: "gemini-3-flash-preview",
    PRO: "gemini-3-pro-preview",
    LIVE: "gemini-2.5-flash-native-audio-preview-12-2025" // Live API still uses 2.5
} as const;

// Retry configuration
const MAX_RETRIES = 2;
const INITIAL_RETRY_DELAY = 500;
const REQUEST_TIMEOUT = 30000; // 30 seconds

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
}

class GeminiService {
    private client: GoogleGenAI;

    constructor() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY environment variable is not set");
        }
        this.client = new GoogleGenAI({ apiKey });
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
     * Map file mime type to Gemini-supported format
     */
    private getGeminiMimeType(mimeType: string): string {
        const supported: Record<string, string> = {
            "application/pdf": "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "application/msword": "application/msword",
        };
        return supported[mimeType] || "application/pdf";
    }

    /**
     * Parse resume from base64 document (PDF, DOC, DOCX)
     */
    async parseResume(base64Data: string, mimeType = "application/pdf"): Promise<CandidateProfile> {
        return this.retryWithBackoff(async () => {
            const geminiMime = this.getGeminiMimeType(mimeType);

            const prompt = `Extract resume data. If NOT a resume/CV, set isResume:false. If it IS a resume:
- name, jobTitle (current role, skip generic like "Employee"), summary (1-2 sentences)
- experienceEntries: [{title,company,dates}] for each role
- experience: key bullet points, skills: array, education: array
- rawResumeText: concise extracted text (~500 chars)
- isResume: true/false
Use empty strings/arrays for missing sections. Be concise.`;

            const response = await this.client.models.generateContent({
                model: MODELS.FLASH,
                contents: {
                    parts: [
                        {
                            inlineData: {
                                mimeType: geminiMime,
                                data: base64Data
                            }
                        },
                        { text: prompt }
                    ]
                },
                config: {
                    maxOutputTokens: 2048,
                    temperature: 0.1,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            name: { type: Type.STRING },
                            jobTitle: { type: Type.STRING },
                            summary: { type: Type.STRING },
                            experienceEntries: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        title: { type: Type.STRING },
                                        company: { type: Type.STRING },
                                        dates: { type: Type.STRING }
                                    }
                                }
                            },
                            experience: { type: Type.ARRAY, items: { type: Type.STRING } },
                            skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                            education: { type: Type.ARRAY, items: { type: Type.STRING } },
                            rawResumeText: { type: Type.STRING },
                            isResume: { type: Type.BOOLEAN }
                        },
                        required: ["name", "experience", "skills", "education", "rawResumeText", "isResume"]
                    }
                }
            });

            const text = response.text;
            if (!text) {
                throw new Error("Empty response from Gemini API");
            }

            const parsed = JSON.parse(text) as CandidateProfile & {
                jobTitle?: string;
                summary?: string;
                experienceEntries?: { title: string; company: string; dates: string }[];
                isResume: boolean;
            };

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
    async generatePanelists(jobRole: string, resumeSummary: string): Promise<Panelist[]> {
        return this.retryWithBackoff(async () => {
            const prompt = `
        Create 3 distinct interviewer personas for a panel interview for the job role of: "${jobRole}".
        
        Candidate Resume Summary: 
        ${resumeSummary.slice(0, 2000)}...
        
        The panel should be diverse and cover different aspects of the role:
        1. Technical/Functional Expert (Deep dive into hard skills)
        2. Strategic/Managerial Lead (Focus on big picture, product, or impact)
        3. Cultural/HR Representative (Focus on soft skills, values, and collaboration)

        For each panelist, provide:
        - Name (simple first + last name. Include 1–2 Indian names in the panel, e.g., Raj Kumar, Priya Sharma; others can be global, e.g., Alex Chen, Sarah Kim. Keep all names short and easy to remember.)
        - Role (e.g., Senior Engineer, Product Director, HR Business Partner)
        - Focus (Short label, e.g., "System Design", "Product Strategy")
        - Description (Specific questioning style and personality traits. e.g., "Asks grilling questions about security" or "Friendly but probes on conflict resolution")
        - AvatarColor (Pick one: "blue", "green", "pink", "purple", "orange", "red")

        Return a JSON array of 3 objects.
      `;

            const response = await this.client.models.generateContent({
                model: MODELS.FLASH,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                id: { type: Type.STRING },
                                name: { type: Type.STRING },
                                role: { type: Type.STRING },
                                focus: { type: Type.STRING },
                                avatarColor: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["name", "role", "focus", "avatarColor", "description"]
                        }
                    }
                }
            });

            const text = response.text;
            if (!text) {
                throw new Error("Empty response from Gemini API");
            }

            const rawPanelists = JSON.parse(text) as Panelist[];
            const voices = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Aoede'];

            // Ensure IDs are unique and valid, and assign voices
            return rawPanelists.map((p, i) => ({
                ...p,
                id: (i + 1).toString(),
                voiceName: voices[i % voices.length]
            }));
        });
    }

    /**
     * Generate final evaluation report
     */
    async generateFinalReport(
        candidate: CandidateProfile,
        transcriptSummary: string
    ): Promise<FinalReport> {
        return this.retryWithBackoff(async () => {
            const prompt = `
        You are an expert hiring committee. Based on the candidate's resume and the transcript of the panel interview for the role of "${candidate.targetRole || 'their field'}", generate a final evaluation report.
        
        Resume Summary: ${JSON.stringify(candidate)}
        
        Interview Transcript/Summary:
        ${transcriptSummary}
        
        Provide a JSON output with numerical scores (0-100), detailed feedback, specific improvements, and individual comments from the personas.
        
        Thinking Process:
        1. Analyze technical depth based on the transcript relative to the target role.
        2. Evaluate communication clarity and confidence.
        3. Assess cultural fit and enthusiasm.
        4. Identify specific strengths and areas for improvement.
      `;

            const response = await this.client.models.generateContent({
                model: MODELS.PRO,
                contents: prompt,
                config: {
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            technicalScore: { type: Type.NUMBER },
                            communicationScore: { type: Type.NUMBER },
                            cultureFitScore: { type: Type.NUMBER },
                            detailedFeedback: { type: Type.STRING },
                            improvements: { type: Type.ARRAY, items: { type: Type.STRING } },
                            panelistComments: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        name: { type: Type.STRING },
                                        comment: { type: Type.STRING }
                                    }
                                }
                            }
                        }
                    }
                }
            });

            const text = response.text;
            if (!text) {
                throw new Error("Empty response from Gemini API");
            }

            return JSON.parse(text) as FinalReport;
        });
    }
}

export const geminiService = new GeminiService();
