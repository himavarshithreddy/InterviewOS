import { GoogleGenAI, Type } from "@google/genai";
import { CandidateProfile, FinalReport, Panelist } from "../types";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key not found");
    return new GoogleGenAI({ apiKey });
};

export const parseResume = async (base64Pdf: string): Promise<CandidateProfile> => {
    const ai = getClient();
    
    const prompt = `
      Extract the candidate's name, key experience points, skills, and education from this resume.
      Also provide the full raw text summary of the resume.
      Return the result in JSON format.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
            parts: [
                {
                    inlineData: {
                        mimeType: "application/pdf",
                        data: base64Pdf
                    }
                },
                { text: prompt }
            ]
        },
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    experience: { type: Type.ARRAY, items: { type: Type.STRING } },
                    skills: { type: Type.ARRAY, items: { type: Type.STRING } },
                    education: { type: Type.ARRAY, items: { type: Type.STRING } },
                    rawResumeText: { type: Type.STRING }
                },
                required: ["name", "experience", "skills", "education", "rawResumeText"]
            }
        }
    });

    const text = response.text;
    if (!text) throw new Error("Failed to parse resume");
    return JSON.parse(text) as CandidateProfile;
};

export const generatePanelists = async (jobRole: string, resumeSummary: string): Promise<Panelist[]> => {
    const ai = getClient();
    
    const prompt = `
      Create 3 distinct interviewer personas for a panel interview for the job role of: "${jobRole}".
      
      Candidate Resume Summary: 
      ${resumeSummary.slice(0, 2000)}...
      
      The panel should be diverse and cover different aspects of the role:
      1. Technical/Functional Expert (Deep dive into hard skills)
      2. Strategic/Managerial Lead (Focus on big picture, product, or impact)
      3. Cultural/HR Representative (Focus on soft skills, values, and collaboration)

      For each panelist, provide:
      - Name
      - Role (e.g., Senior Engineer, Product Director, HR BP)
      - Focus (Short label)
      - Description (Specific questioning style and personality traits. e.g., "Ask grilling questions about security" or "Friendly but probes on conflict resolution")
      - AvatarColor (Pick one: "blue", "green", "pink", "purple", "orange", "red")

      Return a JSON array of 3 objects.
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
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
    if (!text) throw new Error("Failed to generate panelists");
    
    const rawPanelists = JSON.parse(text) as Panelist[];
    // Ensure IDs are unique
    return rawPanelists.map((p, i) => ({ ...p, id: (i + 1).toString() }));
};

export const generateFinalReport = async (
    candidate: CandidateProfile, 
    transcriptSummary: string
): Promise<FinalReport> => {
    const ai = getClient();

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
    `;

    // Using Gemini 3 Pro for deep reasoning on the evaluation
    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            // thinkingConfig: { thinkingBudget: 2048 }, // Optional: Enable thinking for better reasoning if needed
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
    if (!text) throw new Error("Failed to generate report");
    return JSON.parse(text) as FinalReport;
};
