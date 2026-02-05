import { CandidateProfile, Panelist, InterviewSession, TranscriptMessage } from '../types';

const SESSION_KEYS = {
    CANDIDATE: 'interviewos_candidate',
    PANELISTS: 'interviewos_panelists',
    SESSION: 'interviewos_session',
    TRANSCRIPT: 'interviewos_transcript',
} as const;

/**
 * Session storage utilities for persisting interview state
 */
export const sessionStorage = {
    /**
     * Save candidate profile
     */
    saveCandidate(candidate: CandidateProfile): void {
        try {
            window.sessionStorage.setItem(SESSION_KEYS.CANDIDATE, JSON.stringify(candidate));
        } catch (error) {
            console.error('Failed to save candidate to session storage:', error);
        }
    },

    /**
     * Get candidate profile
     */
    getCandidate(): CandidateProfile | null {
        try {
            const data = window.sessionStorage.getItem(SESSION_KEYS.CANDIDATE);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get candidate from session storage:', error);
            return null;
        }
    },

    /**
     * Save panelists
     */
    savePanelists(panelists: Panelist[]): void {
        try {
            window.sessionStorage.setItem(SESSION_KEYS.PANELISTS, JSON.stringify(panelists));
        } catch (error) {
            console.error('Failed to save panelists to session storage:', error);
        }
    },

    /**
     * Get panelists
     */
    getPanelists(): Panelist[] | null {
        try {
            const data = window.sessionStorage.getItem(SESSION_KEYS.PANELISTS);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get panelists from session storage:', error);
            return null;
        }
    },

    /**
     * Save interview session
     */
    saveSession(session: Partial<InterviewSession>): void {
        try {
            window.sessionStorage.setItem(SESSION_KEYS.SESSION, JSON.stringify(session));
        } catch (error) {
            console.error('Failed to save session to session storage:', error);
        }
    },

    /**
     * Get interview session
     */
    getSession(): Partial<InterviewSession> | null {
        try {
            const data = window.sessionStorage.getItem(SESSION_KEYS.SESSION);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get session from session storage:', error);
            return null;
        }
    },

    /**
     * Save transcript messages
     */
    saveTranscript(messages: TranscriptMessage[]): void {
        try {
            // Only save last 100 messages to prevent storage overflow
            const trimmed = messages.slice(-100);
            window.sessionStorage.setItem(SESSION_KEYS.TRANSCRIPT, JSON.stringify(trimmed));
        } catch (error) {
            console.error('Failed to save transcript to session storage:', error);
        }
    },

    /**
     * Get transcript messages
     */
    getTranscript(): TranscriptMessage[] | null {
        try {
            const data = window.sessionStorage.getItem(SESSION_KEYS.TRANSCRIPT);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Failed to get transcript from session storage:', error);
            return null;
        }
    },

    /**
     * Clear all session data
     */
    clearAll(): void {
        try {
            Object.values(SESSION_KEYS).forEach(key => {
                window.sessionStorage.removeItem(key);
            });
        } catch (error) {
            console.error('Failed to clear session storage:', error);
        }
    },

    /**
     * Check if session exists
     */
    hasSession(): boolean {
        return window.sessionStorage.getItem(SESSION_KEYS.SESSION) !== null;
    },
};
