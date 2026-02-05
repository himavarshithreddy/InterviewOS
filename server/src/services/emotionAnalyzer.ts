import { GoogleGenAI } from '@google/genai';
import { MODELS } from './geminiService.js';

/**
 * Emotion & Sentiment Analysis Service
 * Analyzes voice tone, facial expressions, and sentiment in real-time
 */

export interface EmotionAnalysis {
    // Primary emotions (0-1 scale)
    confidence: number;
    nervousness: number;
    enthusiasm: number;
    stress: number;
    engagement: number;

    // Sentiment
    sentiment: 'positive' | 'neutral' | 'negative';
    sentimentScore: number; // -1 to 1

    // Voice characteristics
    voiceMetrics: {
        pace: 'too_fast' | 'optimal' | 'too_slow';
        volume: 'too_quiet' | 'optimal' | 'too_loud';
        clarity: number; // 0-1
        monotone: boolean;
    };

    // Facial analysis (if video available)
    facialMetrics?: {
        eyeContact: number; // 0-1
        smiling: boolean;
        frowning: boolean;
        microExpressions: string[];
    };

    // Overall assessment
    overallState: 'confident' | 'nervous' | 'engaged' | 'disengaged' | 'stressed';
    recommendations: string[];
    timestamp: number;
}

export interface EmotionTrend {
    timeline: Array<{
        timestamp: number;
        confidence: number;
        nervousness: number;
        enthusiasm: number;
    }>;
    averages: {
        confidence: number;
        nervousness: number;
        enthusiasm: number;
    };
    trend: 'improving' | 'stable' | 'declining';
}

export class EmotionAnalyzer {
    private client: GoogleGenAI;
    private emotionHistory: EmotionAnalysis[] = [];

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Analyze emotion from audio data
     */
    async analyzeAudio(audioData: string, transcript: string): Promise<EmotionAnalysis> {
        try {
            const prompt = `
Analyze the emotional state and voice characteristics from this interview response.

Transcript: "${transcript}"

Provide a detailed analysis including:
1. Confidence level (0-1): How confident does the speaker sound?
2. Nervousness level (0-1): Signs of anxiety or stress?
3. Enthusiasm level (0-1): How engaged and excited?
4. Stress level (0-1): Overall stress indicators?
5. Engagement level (0-1): How present and focused?
6. Sentiment (positive/neutral/negative): Overall emotional tone
7. Voice pace (too_fast/optimal/too_slow): Speaking speed
8. Voice volume (too_quiet/optimal/too_loud): Volume level
9. Clarity (0-1): How clear and articulate?
10. Monotone (true/false): Lack of vocal variety?

Also provide:
- Overall state: One of [confident, nervous, engaged, disengaged, stressed]
- 2-3 specific recommendations for improvement

Format your response as JSON.
            `.trim();

            const model = this.client.getGenerativeModel({ model: MODELS.FLASH });
            const result = await model.generateContent({
                contents: [{
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: 'audio/wav', data: audioData } }
                    ]
                }]
            });

            const response = result.response.text();
            const analysis = this.parseEmotionResponse(response, transcript);

            this.emotionHistory.push(analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing emotion:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Analyze emotion from video frame
     */
    async analyzeVideo(videoFrame: string, transcript: string): Promise<EmotionAnalysis> {
        try {
            const prompt = `
Analyze the emotional state, facial expressions, and body language from this video frame during an interview.

Transcript of what they're saying: "${transcript}"

Provide analysis including:
1. Eye contact (0-1): Are they looking at the camera?
2. Facial expressions: Smiling, frowning, neutral?
3. Micro-expressions: Any subtle emotional leaks?
4. Confidence level (0-1): Based on facial cues
5. Nervousness level (0-1): Signs of anxiety?
6. Enthusiasm level (0-1): Facial engagement?
7. Overall emotional state

Provide 2-3 specific recommendations for improving presentation.

Format as JSON.
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
            const analysis = this.parseEmotionResponse(response, transcript);

            this.emotionHistory.push(analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing video:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Analyze emotion from text transcript only (fallback)
     */
    async analyzeText(transcript: string): Promise<EmotionAnalysis> {
        try {
            const prompt = `
Analyze the emotional state and sentiment from this interview response text.

Response: "${transcript}"

Based on word choice, sentence structure, and content, estimate:
1. Confidence level (0-1)
2. Nervousness level (0-1) - Look for hedging, uncertainty
3. Enthusiasm level (0-1) - Positive language, energy
4. Stress level (0-1)
5. Engagement level (0-1)
6. Sentiment (positive/neutral/negative)

Provide 2-3 recommendations for improving the response.

Format as JSON with these exact fields:
{
  "confidence": 0.0-1.0,
  "nervousness": 0.0-1.0,
  "enthusiasm": 0.0-1.0,
  "stress": 0.0-1.0,
  "engagement": 0.0-1.0,
  "sentiment": "positive|neutral|negative",
  "sentimentScore": -1.0 to 1.0,
  "overallState": "confident|nervous|engaged|disengaged|stressed",
  "recommendations": ["...", "...", "..."]
}
            `.trim();

            const model = this.client.getGenerativeModel({ model: MODELS.FLASH });
            const result = await model.generateContent(prompt);
            const response = result.response.text();

            const analysis = this.parseEmotionResponse(response, transcript);
            this.emotionHistory.push(analysis);
            return analysis;

        } catch (error) {
            console.error('Error analyzing text emotion:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Parse Gemini response into EmotionAnalysis
     */
    private parseEmotionResponse(response: string, transcript: string): EmotionAnalysis {
        try {
            // Extract JSON from response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return this.getDefaultAnalysis();
            }

            const data = JSON.parse(jsonMatch[0]);

            return {
                confidence: data.confidence || 0.5,
                nervousness: data.nervousness || 0.3,
                enthusiasm: data.enthusiasm || 0.5,
                stress: data.stress || 0.3,
                engagement: data.engagement || 0.7,
                sentiment: data.sentiment || 'neutral',
                sentimentScore: data.sentimentScore || 0,
                voiceMetrics: {
                    pace: data.pace || 'optimal',
                    volume: data.volume || 'optimal',
                    clarity: data.clarity || 0.7,
                    monotone: data.monotone || false
                },
                facialMetrics: data.eyeContact ? {
                    eyeContact: data.eyeContact || 0.5,
                    smiling: data.smiling || false,
                    frowning: data.frowning || false,
                    microExpressions: data.microExpressions || []
                } : undefined,
                overallState: data.overallState || 'engaged',
                recommendations: data.recommendations || ['Keep practicing!'],
                timestamp: Date.now()
            };
        } catch (error) {
            console.error('Error parsing emotion response:', error);
            return this.getDefaultAnalysis();
        }
    }

    /**
     * Get emotion trend over time
     */
    getEmotionTrend(): EmotionTrend {
        if (this.emotionHistory.length === 0) {
            return {
                timeline: [],
                averages: { confidence: 0, nervousness: 0, enthusiasm: 0 },
                trend: 'stable'
            };
        }

        const timeline = this.emotionHistory.map(e => ({
            timestamp: e.timestamp,
            confidence: e.confidence,
            nervousness: e.nervousness,
            enthusiasm: e.enthusiasm
        }));

        const averages = {
            confidence: this.average(this.emotionHistory.map(e => e.confidence)),
            nervousness: this.average(this.emotionHistory.map(e => e.nervousness)),
            enthusiasm: this.average(this.emotionHistory.map(e => e.enthusiasm))
        };

        // Determine trend by comparing first half to second half
        const midpoint = Math.floor(this.emotionHistory.length / 2);
        const firstHalf = this.emotionHistory.slice(0, midpoint);
        const secondHalf = this.emotionHistory.slice(midpoint);

        const firstAvg = this.average(firstHalf.map(e => e.confidence - e.nervousness));
        const secondAvg = this.average(secondHalf.map(e => e.confidence - e.nervousness));

        const trend = secondAvg > firstAvg + 0.1 ? 'improving' :
            secondAvg < firstAvg - 0.1 ? 'declining' : 'stable';

        return { timeline, averages, trend };
    }

    /**
     * Get latest emotion analysis
     */
    getLatestEmotion(): EmotionAnalysis | null {
        return this.emotionHistory.length > 0
            ? this.emotionHistory[this.emotionHistory.length - 1]
            : null;
    }

    /**
     * Clear emotion history
     */
    clearHistory(): void {
        this.emotionHistory = [];
    }

    /**
     * Helper: Calculate average
     */
    private average(numbers: number[]): number {
        if (numbers.length === 0) return 0;
        return numbers.reduce((a, b) => a + b, 0) / numbers.length;
    }

    /**
     * Default analysis when parsing fails
     */
    private getDefaultAnalysis(): EmotionAnalysis {
        return {
            confidence: 0.5,
            nervousness: 0.3,
            enthusiasm: 0.5,
            stress: 0.3,
            engagement: 0.7,
            sentiment: 'neutral',
            sentimentScore: 0,
            voiceMetrics: {
                pace: 'optimal',
                volume: 'optimal',
                clarity: 0.7,
                monotone: false
            },
            overallState: 'engaged',
            recommendations: ['Continue practicing to improve confidence'],
            timestamp: Date.now()
        };
    }
}
