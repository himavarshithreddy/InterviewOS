/**
 * Tier 2: Voice Activity Detection hook for faster end-of-speech detection
 * Uses @ricky0123/vad-react (Silero VAD) to detect when user stops speaking
 * 100-200ms faster than relying on Gemini's server-side turn detection
 */
import { useMicVAD } from '@ricky0123/vad-react';
import { useRef, useCallback, useEffect } from 'react';

interface UseVADOptions {
  /** Only run VAD when connected to interview */
  enabled: boolean;
  /** Callback when user stops speaking - triggers immediate orchestration hint */
  onSpeechEnd: () => void;
  /** Callback when user starts speaking - can cancel pending pre-warms */
  onSpeechStart?: () => void;
  /** Custom stream - when provided, use this instead of creating new one */
  stream: MediaStream | null;
}

export function useVAD({ enabled, onSpeechEnd, onSpeechStart, stream }: UseVADOptions) {
  const onSpeechEndRef = useRef(onSpeechEnd);
  const onSpeechStartRef = useRef(onSpeechStart);
  const streamRef = useRef(stream);
  onSpeechEndRef.current = onSpeechEnd;
  onSpeechStartRef.current = onSpeechStart;
  streamRef.current = stream;

  const vad = useMicVAD({
    startOnLoad: false,
    getStream: async () => {
      const s = streamRef.current;
      if (s) return s;
      throw new Error('No stream for VAD');
    },
    onSpeechEnd: () => {
      onSpeechEndRef.current?.();
    },
    onSpeechStart: () => {
      onSpeechStartRef.current?.();
    },
    redemptionFrames: 8, // ~250ms of silence to confirm speech end (faster response)
    minSpeechFrames: 3, // Minimum speech frames before considering it speech
  });

  // Start VAD when we have stream and are enabled
  useEffect(() => {
    if (enabled && stream && !vad.listening) {
      const startResult = vad.start?.();
      if (startResult != null && typeof startResult.catch === 'function') {
        startResult.catch((err: unknown) => console.warn('VAD start failed:', err));
      }
    }
  }, [enabled, stream, vad.listening, vad.start]);

  // Pause VAD when disabled
  useEffect(() => {
    if (!enabled && vad.listening) {
      const pauseResult = vad.pause?.();
      if (pauseResult != null && typeof pauseResult.catch === 'function') {
        pauseResult.catch(() => {});
      }
    }
  }, [enabled, vad.listening, vad.pause]);

  return vad;
}
