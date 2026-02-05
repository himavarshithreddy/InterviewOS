import { GoogleGenAI } from '@google/genai';
import { MODELS } from './geminiService.js';

/**
 * Body Language & Presentation Coach
 * Analyzes posture, gestures, eye contact, and speaking patterns
 */

export interface BodyLanguageAnalysis {
    // Posture & Position
    posture: {
        score: number; // 0-1
        issues: string[]; // e.g., "slouching", "leaning too far"
        recommendation: string;
    };

    // Eye Contact
    eyeContact: {
        score: number; // 0-1
        percentage: number; // % of time looking at camera
        issues: string[]; // e.g., "looking away too often"
        recommendation: string;
    };

    // Hand Gestures
    gestures: {
        score: number; // 0-1
        frequency: 'none' | 'minimal' | 'appropriate' | 'excessive';
        types: string[]; // e.g., "pointing", "open palms", "fidgeting"
        recommendation: string;
    };

    // Facial Expressions
    facialExpression: {
        score: number; // 0-1
        primary: string; // e.g., "neutral", "smiling", "frowning"
        variety: number; // 0-1, how much expression changes
        recommendation: string;
    };

    // Overall presentation score
    overallScore: number; // 0-100
    grade: 'A' | 'B' | 'C' | 'D' | 'F';
    strengths: string[];
    improvements: string[];
    timestamp: number;
}

export interface SpeechPatternAnalysis {
    // Speaking pace
    pace: {
        wordsPerMinute: number;
        assessment: 'too_slow' | 'optimal' | 'too_fast';
        recommendation: string;
    };

    // Filler words
    fillerWords: {
        count: number;
        types: Map<string, number>; // "um" -> 5, "like" -> 3
        percentage: number; // % of total words
        recommendation: string;
    };

    // Pauses
    pauses: {
        count: number;
        averageDuration: number; // seconds
        assessment: 'too_few' | 'optimal' | 'too_many';
        recommendation: string;
    };

    // Clarity & Articulation
    clarity: {
        score: number; // 0-1
        issues: string[]; // e.g., "mumbling", "unclear pronunciation"
        recommendation: string;
    };

    // Volume & Projection
    volume: {
        score: number; // 0-1
        assessment: 'too_quiet' | 'optimal' | 'too_loud';
        consistency: number; // 0-1
        recommendation: string;
    };

    timestamp: number;
}

export class PresentationCoach {
    private client: GoogleGenAI;
    private bodyLanguageHistory: BodyLanguageAnalysis[] = [];
    private speechPatternHistory: SpeechPatternAnalysis[] = [];

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Analyze body language from video frame
     */
    async analyzeBodyLanguage(videoFrame: string): Promise<BodyLanguageAnalysis> {
        try {
            const prompt = `
You are a professional presentation coach analyzing body language during an interview.

Analyze this video frame and provide detailed feedback on:

1. POSTURE (0-1 score):
   - Are they sitting up straight?
   - Shoulders back or slouching?
   - Leaning forward (engaged) or backward (disengaged)?
   - Issues and recommendation

2. EYE CONTACT (0-1 score):
   - Looking at camera (good) or away (bad)?
   - Estimate % of time with eye contact
   - Issues and recommendation

3. HAND GESTURES (0-1 score):
   - Frequency: none, minimal, appropriate, excessive
   - Types: pointing, open palms, fidgeting, hands hidden, etc.
   - Issues and recommendation

4. FACIAL EXPRESSION (0-1 score):
   - Primary expression: neutral, smiling, frowning, etc.
   - Variety (0-1): How expressive are they?
   - Issues and recommendation

5. OVERALL ASSESSMENT:
   - Overall score (0-100)
   - Grade (A/B/C/D/F)
   - 2-3 specific strengths
   - 2-3 specific improvements

Format as JSON with these exact fields:
{
  "posture": { "score": 0.0-1.0, "issues": ["..."], "recommendation": "..." },
  "eyeContact": { "score": 0.0-1.0, "percentage": 0-100, "issues": ["..."], "recommendation": "..." },
  "gestures": { "score": 0.0-1.0, "frequency": "none|minimal|appropriate|excessive", "types": ["..."], "recommendation": "..." },
  "facialExpression": { "score": 0.0-1.0, "primary": "...", "variety": 0.0-1.0, "recommendation": "..." },
  "overallScore": 0-100,
  "grade": "A|B|C|D|F",
  "strengths": ["...", "..."],
  "improvements": ["...", "..."]
}
            `.trim();

            const model = this.client.getGenerativeModel({ model: MODELS.FLASH });
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: 'image/jpeg', data: videoFrame } }
                    ]
                }]
            });

            const response = result.response.text();
            const analysis = this.parseBodyLanguageResponse(response);

            this.bodyLanguageHistory.push(analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing body language:', error);
            return this.getDefaultBodyLanguageAnalysis();
        }
    }

    /**
     * Analyze speech patterns from transcript and audio
     */
    async analyzeSpeechPatterns(transcript: string, audioData?: string): Promise<SpeechPatternAnalysis> {
        try {
            // Count filler words
            const fillerWords = this.countFillerWords(transcript);
            const wordCount = transcript.split(/\s+/).length;
            const fillerPercentage = (fillerWords.count / wordCount) * 100;

            const prompt = `
You are a professional speech coach analyzing speaking patterns during an interview.

Transcript: "${transcript}"
Word count: ${wordCount}
Filler words detected: ${fillerWords.count} (${fillerPercentage.toFixed(1)}%)

Analyze and provide feedback on:

1. SPEAKING PACE:
   - Estimate words per minute (typical interview: 120-150 WPM)
   - Assessment: too_slow (<100), optimal (100-160), too_fast (>160)
   - Recommendation

2. PAUSES:
   - Estimate number of pauses
   - Average pause duration
   - Assessment: too_few, optimal, too_many
   - Recommendation

3. CLARITY & ARTICULATION (0-1 score):
   - How clear and well-articulated?
   - Any issues: mumbling, unclear pronunciation, etc.
   - Recommendation

4. VOLUME & PROJECTION (0-1 score):
   - Assessment: too_quiet, optimal, too_loud
   - Consistency (0-1): Does volume vary appropriately?
   - Recommendation

Format as JSON:
{
  "pace": { "wordsPerMinute": 0, "assessment": "too_slow|optimal|too_fast", "recommendation": "..." },
  "pauses": { "count": 0, "averageDuration": 0.0, "assessment": "too_few|optimal|too_many", "recommendation": "..." },
  "clarity": { "score": 0.0-1.0, "issues": ["..."], "recommendation": "..." },
  "volume": { "score": 0.0-1.0, "assessment": "too_quiet|optimal|too_loud", "consistency": 0.0-1.0, "recommendation": "..." }
}
            `.trim();

            const parts: any[] = [{ text: prompt }];
            if (audioData) {
                parts.push({ inlineData: { mimeType: 'audio/wav', data: audioData } });
            }

            const model = this.client.getGenerativeModel({ model: MODELS.FLASH });
            const result = await model.generateContent({
                contents: [{ role: 'user', parts }]
            });

            const response = result.response.text();
            const analysis = this.parseSpeechPatternResponse(response, fillerWords);

            this.speechPatternHistory.push(analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing speech patterns:', error);
            return this.getDefaultSpeechPatternAnalysis();
        }
    }

    /**
     * Count filler words in transcript
     */
    private countFillerWords(transcript: string): { count: number; types: Map<string, number> } {
        const fillerWordList = [
            'um', 'uh', 'like', 'you know', 'i mean', 'sort of', 'kind of',
            'basically', 'actually', 'literally', 'so', 'well', 'right',
            'okay', 'yeah', 'hmm', 'er', 'ah'
        ];

        const types = new Map<string, number>();
        let totalCount = 0;

        const lowerTranscript = transcript.toLowerCase();

        for (const filler of fillerWordList) {
            const regex = new RegExp(`\\b${filler}\\b`, 'gi');
            const matches = lowerTranscript.match(regex);
            if (matches) {
                const count = matches.length;
                types.set(filler, count);
                totalCount += count;
            }
        }

        return { count: totalCount, types };
    }

    /**
     * Get comprehensive presentation report
     */
    getComprehensiveReport(): {
        bodyLanguage: {
            averageScore: number;
            trend: 'improving' | 'stable' | 'declining';
            topStrengths: string[];
            topImprovements: string[];
        };
        speechPatterns: {
            averageClarity: number;
            totalFillerWords: number;
            averagePace: number;
            topIssues: string[];
        };
    } {
        const bodyLanguage = this.getBodyLanguageSummary();
        const speechPatterns = this.getSpeechPatternSummary();

        return { bodyLanguage, speechPatterns };
    }

    /**
     * Get body language summary
     */
    private getBodyLanguageSummary() {
        if (this.bodyLanguageHistory.length === 0) {
            return {
                averageScore: 0,
                trend: 'stable' as const,
                topStrengths: [],
                topImprovements: []
            };
        }

        const scores = this.bodyLanguageHistory.map(b => b.overallScore);
        const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;

        // Determine trend
        const midpoint = Math.floor(scores.length / 2);
        const firstHalf = scores.slice(0, midpoint);
        const secondHalf = scores.slice(midpoint);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

        const trend = secondAvg > firstAvg + 5 ? 'improving' :
            secondAvg < firstAvg - 5 ? 'declining' : 'stable';

        // Aggregate strengths and improvements
        const allStrengths = this.bodyLanguageHistory.flatMap(b => b.strengths);
        const allImprovements = this.bodyLanguageHistory.flatMap(b => b.improvements);

        const topStrengths = this.getMostCommon(allStrengths, 3);
        const topImprovements = this.getMostCommon(allImprovements, 3);

        return { averageScore, trend, topStrengths, topImprovements };
    }

    /**
     * Get speech pattern summary
     */
    private getSpeechPatternSummary() {
        if (this.speechPatternHistory.length === 0) {
            return {
                averageClarity: 0,
                totalFillerWords: 0,
                averagePace: 0,
                topIssues: []
            };
        }

        const averageClarity = this.average(this.speechPatternHistory.map(s => s.clarity.score));
        const totalFillerWords = this.speechPatternHistory.reduce((sum, s) => sum + s.fillerWords.count, 0);
        const averagePace = this.average(this.speechPatternHistory.map(s => s.pace.wordsPerMinute));

        const allIssues = this.speechPatternHistory.flatMap(s => s.clarity.issues);
        const topIssues = this.getMostCommon(allIssues, 3);

        return { averageClarity, totalFillerWords, averagePace, topIssues };
    }

    /**
     * Parse body language response
     */
    private parseBodyLanguageResponse(response: string): BodyLanguageAnalysis {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return this.getDefaultBodyLanguageAnalysis();

            const data = JSON.parse(jsonMatch[0]);

            return {
                posture: data.posture || { score: 0.7, issues: [], recommendation: 'Maintain good posture' },
                eyeContact: data.eyeContact || { score: 0.7, percentage: 70, issues: [], recommendation: 'Look at camera more' },
                gestures: data.gestures || { score: 0.7, frequency: 'appropriate', types: [], recommendation: 'Use natural gestures' },
                facialExpression: data.facialExpression || { score: 0.7, primary: 'neutral', variety: 0.5, recommendation: 'Show more expression' },
                overallScore: data.overallScore || 70,
                grade: data.grade || 'B',
                strengths: data.strengths || ['Good effort'],
                improvements: data.improvements || ['Keep practicing'],
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error parsing body language response:', error);
            return this.getDefaultBodyLanguageAnalysis();
        }
    }

    /**
     * Parse speech pattern response
     */
    private parseSpeechPatternResponse(response: string, fillerWords: { count: number; types: Map<string, number> }): SpeechPatternAnalysis {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return this.getDefaultSpeechPatternAnalysis();

            const data = JSON.parse(jsonMatch[0]);

            return {
                pace: data.pace || { wordsPerMinute: 130, assessment: 'optimal', recommendation: 'Good pace' },
                fillerWords: {
                    count: fillerWords.count,
                    types: fillerWords.types,
                    percentage: (fillerWords.count / 100) * 100, // Rough estimate
                    recommendation: fillerWords.count > 5 ? 'Reduce filler words' : 'Good control of filler words'
                },
                pauses: data.pauses || { count: 3, averageDuration: 1.0, assessment: 'optimal', recommendation: 'Good use of pauses' },
                clarity: data.clarity || { score: 0.8, issues: [], recommendation: 'Speak clearly' },
                volume: data.volume || { score: 0.8, assessment: 'optimal', consistency: 0.8, recommendation: 'Good volume' },
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error parsing speech pattern response:', error);
            return this.getDefaultSpeechPatternAnalysis();
        }
    }

    /**
     * Helper: Get most common items
     */
    private getMostCommon(items: string[], limit: number): string[] {
        const counts = new Map<string, number>();
        items.forEach(item => counts.set(item, (counts.get(item) || 0) + 1));

        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([item]) => item);
    }

    /**
     * Helper: Calculate average
     */
    private average(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    /**
     * Default body language analysis
     */
    private getDefaultBodyLanguageAnalysis(): BodyLanguageAnalysis {
        return {
            posture: { score: 0.7, issues: [], recommendation: 'Sit up straight and maintain good posture' },
            eyeContact: { score: 0.7, percentage: 70, issues: [], recommendation: 'Look at the camera more consistently' },
            gestures: { score: 0.7, frequency: 'appropriate', types: [], recommendation: 'Use natural hand gestures to emphasize points' },
            facialExpression: { score: 0.7, primary: 'neutral', variety: 0.5, recommendation: 'Show more facial expressions' },
            overallScore: 70,
            grade: 'B',
            strengths: ['Maintaining composure'],
            improvements: ['Increase eye contact', 'Use more gestures'],
            timestamp: Date.now()
        };
    }

    /**
     * Default speech pattern analysis
     */
    private getDefaultSpeechPatternAnalysis(): SpeechPatternAnalysis {
        return {
            pace: { wordsPerMinute: 130, assessment: 'optimal', recommendation: 'Maintain current speaking pace' },
            fillerWords: {
                count: 0,
                types: new Map(),
                percentage: 0,
                recommendation: 'Good control of filler words'
            },
            pauses: { count: 3, averageDuration: 1.0, assessment: 'optimal', recommendation: 'Good use of pauses' },
            clarity: { score: 0.8, issues: [], recommendation: 'Continue speaking clearly' },
            volume: { score: 0.8, assessment: 'optimal', consistency: 0.8, recommendation: 'Good volume control' },
            timestamp: Date.now()
        };
    }

    /**
     * Clear history
     */
    clearHistory(): void {
        this.bodyLanguageHistory = [];
        this.speechPatternHistory = [];
    }
}
