export enum AppStage {
  LANDING = 'LANDING',
  RESUME_UPLOAD = 'RESUME_UPLOAD',
  INTERVIEW_PREP = 'INTERVIEW_PREP',
  LIVE_INTERVIEW = 'LIVE_INTERVIEW',
  EVALUATION = 'EVALUATION',
}

export interface CandidateProfile {
  name: string;
  experience: string[];
  skills: string[];
  education: string[];
  rawResumeText: string;
  targetRole?: string;
}

export interface Panelist {
  id: string;
  name: string;
  role: string;
  focus: string;
  avatarColor: string;
  description: string;
}

export interface EvaluationMetric {
  category: string;
  score: number; // 0-100
  feedback: string;
}

export interface FinalReport {
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

// Audio/Video Processing Types
export interface AudioQueueItem {
  buffer: AudioBuffer;
  duration: number;
}
