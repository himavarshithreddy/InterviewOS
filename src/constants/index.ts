import { AvatarColor, ColorClasses } from '@/types';

// API endpoints
export const API_ENDPOINTS = {
    HEALTH: '/api/health',
    PARSE_RESUME: '/api/parse-resume',
    GENERATE_PANELISTS: '/api/generate-panelists',
    GENERATE_REPORT: '/api/generate-report',
    WS_INTERVIEW: '/ws/interview',
    ANALYZE_EMOTION: '/api/analyze-emotion',
    ANALYZE_BODY_LANGUAGE: '/api/analyze-body-language',
    ANALYZE_SPEECH: '/api/analyze-speech',
} as const;

// Error messages
export const ERROR_MESSAGES = {
    NO_FILE: 'Please select a file to upload',
    INVALID_FILE_TYPE: 'Please upload a PDF, DOC, or DOCX file',
    FILE_TOO_LARGE: 'File size must be less than 10MB',
    NO_TARGET_ROLE: 'Please enter a target job role',
    NETWORK_ERROR: 'Network error. Please check your connection.',
    SERVER_ERROR: 'Server error. Please try again later.',
    PARSE_FAILED: 'Failed to parse resume. Please try again.',
    NOT_A_RESUME: "This document does not appear to be a resume. Please upload a resume or CV.",
    PANEL_GENERATION_FAILED: 'Failed to generate interview panel. Please try again.',
    REPORT_GENERATION_FAILED: 'Failed to generate report. Please try again.',
    SESSION_INIT_FAILED: 'Failed to initialize interview session.',
    CONNECTION_LOST: 'Connection lost. Please refresh and try again.',
} as const;

// Color mapping for panelist avatars (matches Tailwind safelist)
export const AVATAR_COLOR_CLASSES: Record<AvatarColor, ColorClasses> = {
    blue: {
        bg: 'bg-blue-600',
        border: 'border-blue-500',
        borderTop: 'border-t-blue-500',
        text: 'text-blue-400',
    },
    green: {
        bg: 'bg-green-600',
        border: 'border-green-500',
        borderTop: 'border-t-green-500',
        text: 'text-green-400',
    },
    pink: {
        bg: 'bg-pink-600',
        border: 'border-pink-500',
        borderTop: 'border-t-pink-500',
        text: 'text-pink-400',
    },
    purple: {
        bg: 'bg-purple-600',
        border: 'border-purple-500',
        borderTop: 'border-t-purple-500',
        text: 'text-purple-400',
    },
    orange: {
        bg: 'bg-orange-600',
        border: 'border-orange-500',
        borderTop: 'border-t-orange-500',
        text: 'text-orange-400',
    },
    red: {
        bg: 'bg-red-600',
        border: 'border-red-500',
        borderTop: 'border-t-red-500',
        text: 'text-red-400',
    },
};

// Minimum interview duration (seconds) for evaluation - skip Gemini API if shorter
export const MIN_INTERVIEW_DURATION_SECONDS = Number(import.meta.env.VITE_MIN_INTERVIEW_DURATION_SECONDS) || 300; // Default: 5 minutes (300 seconds)

// Configuration
export const CONFIG = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ACCEPTED_FILE_TYPES: ['.pdf', '.doc', '.docx'],
    ACCEPTED_MIME_TYPES: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    MAX_TRANSCRIPT_MESSAGES: 100, // Prevent memory leaks
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // ms
    REQUEST_TIMEOUT: 30000, // 30 seconds
} as const;
