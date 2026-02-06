export enum AppStage {
  LANDING = 'LANDING',
  RESUME_UPLOAD = 'RESUME_UPLOAD',
  INTERVIEW_PREP = 'INTERVIEW_PREP',
  LIVE_INTERVIEW = 'LIVE_INTERVIEW',
  EVALUATION = 'EVALUATION',
}

export interface ExperienceEntry {
  title: string;
  company: string;
  dates: string;
}

export interface CandidateProfile {
  name: string;
  experience: string[];
  skills: string[];
  education: string[];
  rawResumeText: string;
  targetRole?: string;
  /** Preview-only: current/most recent job title */
  jobTitle?: string;
  /** Preview-only: 1-2 sentence professional summary */
  summary?: string;
  /** Preview-only: structured work history */
  experienceEntries?: ExperienceEntry[];
  /** Preview-only: false if document is not a resume */
  isResume?: boolean;
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

// Enhanced types for better type safety
export interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'ai';
  panelistName?: string;
  text: string;
  timestamp: number;
}

export interface InterviewSession {
  sessionId: string;
  candidate: CandidateProfile;
  panelists: Panelist[];
  startTime: number;
  status: 'active' | 'paused' | 'ended';
  transcript: TranscriptMessage[];
}

export interface ApiError {
  error: string;
  message: string;
  details?: any;
}

export interface InterviewControls {
  isMuted: boolean;
  isPaused: boolean;
  volume: number; // 0-1
}

export interface InterviewProgress {
  questionCount: number;
  topicsCovered: number;
  timeElapsed: number;
  estimatedRemaining: number;
  currentTopic?: string;
  currentPanelist?: Panelist;
  depth?: number;
}

// Audio/Video Processing Types
export interface AudioQueueItem {
  buffer: AudioBuffer;
  duration: number;
}

// Color mapping for panelist avatars
export type AvatarColor = 'blue' | 'green' | 'pink' | 'purple' | 'orange' | 'red';

export interface ColorClasses {
  bg: string;
  border: string;
  borderTop: string;
  text: string;
}
