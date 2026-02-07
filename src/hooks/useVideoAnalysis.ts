import { useState, useRef, useEffect, useCallback } from 'react';
import { apiClient } from '@/src/services/apiClient';

interface UseVideoAnalysisProps {
    stream: MediaStream | null;
    isRecording: boolean;
    onAnalysisResult?: (type: 'emotion' | 'body_language', data: any) => void;
}

export const useVideoAnalysis = ({ stream, isRecording, onAnalysisResult }: UseVideoAnalysisProps) => {
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isAnalyzingRef = useRef(false); // Ref to guard against overlapping requests
    const [isAnalyzing, setIsAnalyzing] = useState(false);

    /**
     * Convert Blob to Base64
     */
    const blobToBase64 = (blob: Blob): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
                const base64String = reader.result as string;
                // Remove data URL prefix (e.g., "data:video/mp4;base64,")
                const base64Data = base64String.split(',')[1];
                resolve(base64Data);
            };
            reader.onerror = reject;
        });
    };

    /**
     * Capture and analyze a video segment
     */
    const captureAndAnalyze = useCallback(async () => {
        if (!stream || !isRecording) return;
        // Skip if a previous analysis is still in flight
        if (isAnalyzingRef.current) return;

        // Create a new recorder for this segment to ensure valid headers
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp8' // VP8 is widely supported
        });

        const chunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data);
        };

        recorder.onstop = async () => {
            // If we stopped recording globally, don't analyze this tail
            if (!isRecording && chunks.length === 0) return;

            const blob = new Blob(chunks, { type: 'video/webm' });

            try {
                const base64Data = await blobToBase64(blob);

                // Randomly decide whether to check emotion or body language to save tokens/load
                // Or check both. For now, let's alternate or do both.
                // Let's do Body Language primarily as it needs video.

                setIsAnalyzing(true);
                isAnalyzingRef.current = true;
                const bodyAnalysis = await apiClient.analyzeBodyLanguage(base64Data);
                if (onAnalysisResult) {
                    onAnalysisResult('body_language', bodyAnalysis);
                }

            } catch (error) {
                // Silently ignore timeout/network errors during interview
                console.warn('Video analysis skipped:', (error as Error)?.message?.slice(0, 80));
            } finally {
                setIsAnalyzing(false);
                isAnalyzingRef.current = false;
            }
        };

        // Record for 4 seconds
        recorder.start();
        setTimeout(() => {
            if (recorder.state === 'recording') {
                recorder.stop();
            }
        }, 4000);

    }, [stream, isRecording, onAnalysisResult]);

    /**
     * Start/Stop analysis loop
     */
    useEffect(() => {
        if (isRecording && stream) {
            // Initial capture
            captureAndAnalyze();

            // Repeat every 10 seconds (5s record + 5s gap/processing) to avoid overloading
            const id = setInterval(captureAndAnalyze, 10000);
            intervalRef.current = id;
        } else {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }

        return () => {
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [isRecording, stream, captureAndAnalyze]);

    return { isAnalyzing };
};
