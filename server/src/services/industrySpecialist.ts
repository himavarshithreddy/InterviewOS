import { GoogleGenAI } from '@google/genai';
import { MODELS } from './geminiService.js';

/**
 * Industry-Specific Deep Dives
 * Specialized interview preparation for different industries
 */

export type Industry = 'FAANG' | 'Finance' | 'Consulting' | 'Medical' | 'Legal' | 'Startup' | 'General';

export interface IndustryProfile {
    industry: Industry;
    name: string;
    description: string;
    keySkills: string[];
    commonQuestionTypes: string[];
    evaluationCriteria: string[];
    culturalFit: string[];
}

export interface IndustryQuestion {
    id: string;
    industry: Industry;
    category: string;
    difficulty: 'entry' | 'mid' | 'senior' | 'executive';
    question: string;
    context?: string;
    idealAnswerFramework: string;
    keyPoints: string[];
    commonMistakes: string[];
    followUpQuestions: string[];
}

export interface IndustryEvaluation {
    industry: Industry;
    technicalScore: number; // 0-100
    culturalFitScore: number; // 0-100
    communicationScore: number; // 0-100
    industryKnowledgeScore: number; // 0-100
    overallScore: number; // 0-100
    strengths: string[];
    weaknesses: string[];
    industrySpecificFeedback: string[];
    recommendations: string[];
}

export class IndustrySpecialist {
    private client: GoogleGenAI;

    // Industry profiles
    private static readonly INDUSTRY_PROFILES: Record<Industry, IndustryProfile> = {
        FAANG: {
            industry: 'FAANG',
            name: 'Big Tech (FAANG)',
            description: 'Facebook/Meta, Apple, Amazon, Netflix, Google - Top tier technology companies',
            keySkills: [
                'System Design', 'Data Structures & Algorithms', 'Coding',
                'Scalability', 'Distributed Systems', 'Leadership Principles'
            ],
            commonQuestionTypes: [
                'Coding challenges', 'System design', 'Behavioral (STAR method)',
                'Product sense', 'Technical deep dives', 'Culture fit'
            ],
            evaluationCriteria: [
                'Problem-solving ability', 'Code quality', 'Communication',
                'Scalability thinking', 'Trade-off analysis', 'Customer obsession'
            ],
            culturalFit: [
                'Innovation', 'Ownership', 'Data-driven decisions',
                'Customer focus', 'Bias for action', 'Think big'
            ]
        },
        Finance: {
            industry: 'Finance',
            name: 'Finance & Banking',
            description: 'Investment banking, hedge funds, private equity, trading',
            keySkills: [
                'Financial modeling', 'Valuation', 'Market knowledge',
                'Risk management', 'Quantitative analysis', 'Excel mastery'
            ],
            commonQuestionTypes: [
                'Case studies', 'Market analysis', 'Brainteasers',
                'Technical finance', 'Behavioral', 'Walk me through your resume'
            ],
            evaluationCriteria: [
                'Analytical thinking', 'Attention to detail', 'Market awareness',
                'Quantitative skills', 'Communication', 'Work ethic'
            ],
            culturalFit: [
                'High performance', 'Competitive', 'Detail-oriented',
                'Long hours tolerance', 'Team player', 'Integrity'
            ]
        },
        Consulting: {
            industry: 'Consulting',
            name: 'Management Consulting',
            description: 'McKinsey, BCG, Bain, Big 4 consulting',
            keySkills: [
                'Case frameworks', 'Problem structuring', 'Business acumen',
                'Data analysis', 'Client management', 'Presentation skills'
            ],
            commonQuestionTypes: [
                'Case interviews', 'Market sizing', 'Profitability cases',
                'M&A cases', 'Behavioral (fit)', 'Business judgment'
            ],
            evaluationCriteria: [
                'Structured thinking', 'Hypothesis-driven', 'Quantitative ability',
                'Communication', 'Business intuition', 'Coachability'
            ],
            culturalFit: [
                'Client-first', 'Intellectual curiosity', 'Collaborative',
                'Adaptable', 'Professional', 'Impact-driven'
            ]
        },
        Medical: {
            industry: 'Medical',
            name: 'Healthcare & Medical',
            description: 'Physicians, nurses, healthcare administrators, medical research',
            keySkills: [
                'Clinical reasoning', 'Patient care', 'Medical knowledge',
                'Ethical decision-making', 'Communication', 'Empathy'
            ],
            commonQuestionTypes: [
                'Clinical scenarios', 'Ethical dilemmas', 'Patient communication',
                'Medical knowledge', 'Behavioral', 'Situational judgment'
            ],
            evaluationCriteria: [
                'Clinical competence', 'Patient safety', 'Communication',
                'Professionalism', 'Ethical reasoning', 'Teamwork'
            ],
            culturalFit: [
                'Patient-centered', 'Compassionate', 'Evidence-based',
                'Continuous learning', 'Collaborative', 'Ethical'
            ]
        },
        Legal: {
            industry: 'Legal',
            name: 'Law & Legal Services',
            description: 'Law firms, corporate legal, public interest law',
            keySkills: [
                'Legal reasoning', 'Case analysis', 'Writing',
                'Oral advocacy', 'Research', 'Client counseling'
            ],
            commonQuestionTypes: [
                'Case analysis', 'Legal reasoning', 'Ethical scenarios',
                'Writing samples', 'Behavioral', 'Hypotheticals'
            ],
            evaluationCriteria: [
                'Analytical ability', 'Legal knowledge', 'Communication',
                'Attention to detail', 'Ethical judgment', 'Client focus'
            ],
            culturalFit: [
                'Integrity', 'Advocacy', 'Analytical',
                'Detail-oriented', 'Professional', 'Service-minded'
            ]
        },
        Startup: {
            industry: 'Startup',
            name: 'Startups & Entrepreneurship',
            description: 'Early-stage companies, high-growth startups',
            keySkills: [
                'Adaptability', 'Ownership', 'Product thinking',
                'Growth mindset', 'Scrappiness', 'Multi-tasking'
            ],
            commonQuestionTypes: [
                'Product sense', 'Growth strategies', 'Behavioral',
                'Problem-solving', 'Culture fit', 'Passion projects'
            ],
            evaluationCriteria: [
                'Initiative', 'Adaptability', 'Impact',
                'Learning ability', 'Passion', 'Culture add'
            ],
            culturalFit: [
                'Entrepreneurial', 'Flexible', 'Resourceful',
                'Mission-driven', 'Collaborative', 'Risk-tolerant'
            ]
        },
        General: {
            industry: 'General',
            name: 'General Interview Preparation',
            description: 'Universal interview skills applicable across industries',
            keySkills: [
                'Communication', 'Problem-solving', 'Teamwork',
                'Leadership', 'Adaptability', 'Critical thinking'
            ],
            commonQuestionTypes: [
                'Behavioral', 'Situational', 'Competency-based',
                'Strengths/weaknesses', 'Career goals', 'Why this company'
            ],
            evaluationCriteria: [
                'Communication', 'Problem-solving', 'Cultural fit',
                'Motivation', 'Experience', 'Potential'
            ],
            culturalFit: [
                'Professional', 'Collaborative', 'Growth-minded',
                'Reliable', 'Positive attitude', 'Ethical'
            ]
        }
    };

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    /**
     * Get industry profile
     */
    getIndustryProfile(industry: Industry): IndustryProfile {
        return IndustrySpecialist.INDUSTRY_PROFILES[industry];
    }

    /**
     * Generate industry-specific questions
     */
    async generateIndustryQuestions(
        industry: Industry,
        role: string,
        difficulty: 'entry' | 'mid' | 'senior' | 'executive',
        count: number = 5
    ): Promise<IndustryQuestion[]> {
        try {
            const profile = this.getIndustryProfile(industry);

            const prompt = `
You are an expert interviewer for ${profile.name} roles.

Generate ${count} realistic, industry-specific interview questions for a ${difficulty}-level ${role} position.

Industry context:
- Key skills: ${profile.keySkills.join(', ')}
- Common question types: ${profile.commonQuestionTypes.join(', ')}
- Evaluation criteria: ${profile.evaluationCriteria.join(', ')}
- Cultural fit: ${profile.culturalFit.join(', ')}

For each question, provide:
1. The question itself
2. Category (e.g., "Technical", "Behavioral", "Case Study")
3. Context (if needed)
4. Ideal answer framework (how to structure the answer)
5. 3-5 key points a strong answer should cover
6. 2-3 common mistakes candidates make
7. 2-3 potential follow-up questions

Format as JSON array:
[
  {
    "question": "...",
    "category": "...",
    "context": "...",
    "idealAnswerFramework": "...",
    "keyPoints": ["...", "...", "..."],
    "commonMistakes": ["...", "..."],
    "followUpQuestions": ["...", "..."]
  }
]
            `.trim();

            const result = await this.client.models.generateContent({
                model: MODELS.PRO,
                contents: prompt
            });
            const response = result.text || '';

            const questions = this.parseQuestionsResponse(response, industry, difficulty);
            return questions;

        } catch (error) {
            console.error('Error generating industry questions:', error);
            return [];
        }
    }

    /**
     * Evaluate answer with industry-specific criteria
     */
    async evaluateIndustryAnswer(
        industry: Industry,
        question: string,
        answer: string,
        role: string
    ): Promise<IndustryEvaluation> {
        try {
            const profile = this.getIndustryProfile(industry);

            const prompt = `
You are an expert interviewer for ${profile.name} evaluating a candidate for a ${role} position.

Question: "${question}"
Candidate's Answer: "${answer}"

Evaluate this answer based on ${industry} industry standards:

1. Technical Score (0-100): Industry-specific technical knowledge
2. Cultural Fit Score (0-100): Alignment with ${profile.culturalFit.join(', ')}
3. Communication Score (0-100): Clarity, structure, professionalism
4. Industry Knowledge Score (0-100): Understanding of industry norms and practices

Also provide:
- 3-5 specific strengths demonstrated
- 3-5 specific weaknesses or gaps
- 3-5 industry-specific feedback points
- 3-5 actionable recommendations for improvement

Format as JSON:
{
  "technicalScore": 0-100,
  "culturalFitScore": 0-100,
  "communicationScore": 0-100,
  "industryKnowledgeScore": 0-100,
  "overallScore": 0-100,
  "strengths": ["...", "..."],
  "weaknesses": ["...", "..."],
  "industrySpecificFeedback": ["...", "..."],
  "recommendations": ["...", "..."]
}
            `.trim();

            const result = await this.client.models.generateContent({
                model: MODELS.PRO,
                contents: prompt
            });
            const response = result.text || '';

            const evaluation = this.parseEvaluationResponse(response, industry);
            return evaluation;

        } catch (error) {
            console.error('Error evaluating industry answer:', error);
            return this.getDefaultEvaluation(industry);
        }
    }

    /**
     * Get industry-specific interview tips
     */
    async getIndustryTips(industry: Industry, role: string): Promise<string[]> {
        try {
            const profile = this.getIndustryProfile(industry);

            const prompt = `
Provide 10 specific, actionable tips for succeeding in ${profile.name} interviews for a ${role} position.

Focus on:
- Industry-specific preparation strategies
- Common pitfalls to avoid
- Cultural expectations
- Technical preparation
- Communication style
- What interviewers are really looking for

Format as a JSON array of strings.
            `.trim();

            const result = await this.client.models.generateContent({
                model: MODELS.FLASH,
                contents: prompt
            });
            const response = result.text || '';

            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return [];

        } catch (error) {
            console.error('Error getting industry tips:', error);
            return [];
        }
    }

    /**
     * Get company-specific preparation (for FAANG)
     */
    async getCompanySpecificPrep(company: string, role: string): Promise<{
        interviewProcess: string[];
        culturalValues: string[];
        commonQuestions: string[];
        tips: string[];
    }> {
        try {
            const prompt = `
Provide detailed, company-specific interview preparation for ${company} - ${role} position.

Include:
1. Interview process stages (4-6 stages)
2. Key cultural values (3-5 values)
3. Common interview questions (5-7 questions)
4. Company-specific tips (5-7 tips)

Format as JSON:
{
  "interviewProcess": ["...", "..."],
  "culturalValues": ["...", "..."],
  "commonQuestions": ["...", "..."],
  "tips": ["...", "..."]
}
            `.trim();

            const result = await this.client.models.generateContent({
                model: MODELS.PRO,
                contents: prompt
            });
            const response = result.text || '';

            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                return JSON.parse(jsonMatch[0]);
            }

            return {
                interviewProcess: [],
                culturalValues: [],
                commonQuestions: [],
                tips: []
            };

        } catch (error) {
            console.error('Error getting company-specific prep:', error);
            return {
                interviewProcess: [],
                culturalValues: [],
                commonQuestions: [],
                tips: []
            };
        }
    }

    /**
     * Parse questions response
     */
    private parseQuestionsResponse(
        response: string,
        industry: Industry,
        difficulty: 'entry' | 'mid' | 'senior' | 'executive'
    ): IndustryQuestion[] {
        try {
            const jsonMatch = response.match(/\[[\s\S]*\]/);
            if (!jsonMatch) return [];

            const data = JSON.parse(jsonMatch[0]);

            return data.map((q: any, index: number) => ({
                id: `${industry}-${difficulty}-${Date.now()}-${index}`,
                industry,
                category: q.category || 'General',
                difficulty,
                question: q.question || '',
                context: q.context,
                idealAnswerFramework: q.idealAnswerFramework || '',
                keyPoints: q.keyPoints || [],
                commonMistakes: q.commonMistakes || [],
                followUpQuestions: q.followUpQuestions || []
            }));

        } catch (error) {
            console.error('Error parsing questions response:', error);
            return [];
        }
    }

    /**
     * Parse evaluation response
     */
    private parseEvaluationResponse(response: string, industry: Industry): IndustryEvaluation {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return this.getDefaultEvaluation(industry);

            const data = JSON.parse(jsonMatch[0]);

            return {
                industry,
                technicalScore: data.technicalScore || 70,
                culturalFitScore: data.culturalFitScore || 70,
                communicationScore: data.communicationScore || 70,
                industryKnowledgeScore: data.industryKnowledgeScore || 70,
                overallScore: data.overallScore || 70,
                strengths: data.strengths || [],
                weaknesses: data.weaknesses || [],
                industrySpecificFeedback: data.industrySpecificFeedback || [],
                recommendations: data.recommendations || []
            };

        } catch (error) {
            console.error('Error parsing evaluation response:', error);
            return this.getDefaultEvaluation(industry);
        }
    }

    /**
     * Default evaluation
     */
    private getDefaultEvaluation(industry: Industry): IndustryEvaluation {
        return {
            industry,
            technicalScore: 70,
            culturalFitScore: 70,
            communicationScore: 70,
            industryKnowledgeScore: 70,
            overallScore: 70,
            strengths: ['Good effort'],
            weaknesses: ['Needs more practice'],
            industrySpecificFeedback: ['Continue learning industry standards'],
            recommendations: ['Practice more industry-specific scenarios']
        };
    }
}
