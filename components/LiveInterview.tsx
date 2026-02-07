import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, StartSensitivity, EndSensitivity } from "@google/genai";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Activity, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '@/utils/audioUtils';
import { CandidateProfile, Panelist, AvatarColor } from '@/types';
import { AVATAR_COLOR_CLASSES } from '@/src/constants';
import { useVideoAnalysis } from '@/src/hooks/useVideoAnalysis';
import { useVAD } from '@/src/hooks/useVAD';

// Fallback voices for panelists (male, female, male pattern) - used only if backend voiceName is missing
const PANELIST_VOICES = ['Puck', 'Kore', 'Charon', 'Aoede', 'Fenrir'] as const;

interface Props {
  candidate: CandidateProfile;
  panelists: Panelist[];
  onFinish: (transcriptSummary: string, durationSeconds: number, bodyLanguageHistory: any[], emotionHistory: any[]) => void;
}

export const LiveInterview: React.FC<Props> = ({ candidate, panelists, onFinish }) => {
  const [readyToStart, setReadyToStart] = useState(false);
  const [connected, setConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string>("System");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [micPermission, setMicPermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  const [micMuted, setMicMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentPanelistIndex, setCurrentPanelistIndex] = useState(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Analysis State
  const [bodyLanguageHistory, setBodyLanguageHistory] = useState<any[]>([]);
  const [emotionHistory, setEmotionHistory] = useState<any[]>([]);

  // NEW: Interview phase and time management
  const [interviewPhase, setInterviewPhase] = useState<'opening' | 'active' | 'closing' | 'completed'>('opening');
  const [remainingTime, setRemainingTime] = useState<number>(1800); // 30 min in seconds
  const [showClosingToast, setShowClosingToast] = useState(false);

  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const sessionRef = useRef<any>(null);
  const audioQueueRef = useRef<string[]>([]);
  const isPlayingAudioRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const interruptedRef = useRef(false);
  const audioGainRef = useRef<GainNode | null>(null);
  // Refs for transcript accumulation (avoids race when word-by-word chunks arrive rapidly)
  const transcriptLinesRef = useRef<string[]>([]);
  const currentLineRef = useRef<{ speaker: string; content: string; prefix: string } | null>(null);
  const currentUserLineRef = useRef<string>(''); // Full accumulated user text for current turn
  const lastSegmentTextRef = useRef<string>(''); // Tracks Gemini's cumulative text within current segment
  const segmentStartLenRef = useRef<number>(0); // Length of currentUserLineRef when current segment started
  const turnBoundaryRef = useRef(false); // Tracks when user finishes speaking → next AI output starts new dialog
  const lastAppendedChunksRef = useRef<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Phase 3 + Tier 6: Pre-decode lookahead (3 chunks) to reduce playback latency
  const preDecodedBuffersRef = useRef<AudioBuffer[]>([]);

  // Phase 2: Batched transcript updates
  const pendingTranscriptUpdateRef = useRef<string[] | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Turn-taking management
  const aiRef = useRef<GoogleGenAI | null>(null);
  const currentPanelistRef = useRef<number>(0);
  const isSwitchingSessionRef = useRef(false);
  const pendingResponseRef = useRef(false);
  const lastSpeakerChangeRef = useRef<number>(Date.now());
  const questionCountRef = useRef<number>(0);

  // Tier 1: Overlapped session creation - pre-warm next panelist before switch
  const preWarmedSessionRef = useRef<{ index: number; session: any } | null>(null);
  const preWarmInProgressRef = useRef<number | null>(null);

  // Orchestration WebSocket
  const orchestrationWsRef = useRef<WebSocket | null>(null);
  const [orchestrationHint, setOrchestrationHint] = useState<any>(null);
  const lastOrchestrationUpdateRef = useRef<number>(0);
  const ORCHESTRATION_THROTTLE_MS = 500; // Tier 5: Reduced from 2000ms for fresher hints

  // Ref for handleLiveMessage (used by pre-warmed sessions before fn is defined)
  const handleLiveMessageRef = useRef<(message: LiveServerMessage, panelistName?: string) => void>(() => {});

  const handleLiveMessageCountRef = useRef(0);

  // Latency metrics (DEV instrumentation)
  const currentTurnIdRef = useRef<number>(0);
  const lastUserAudioChunkTsRef = useRef<number | null>(null);
  const userStopTsRef = useRef<number | null>(null);
  const firstTranscriptTokenTsRef = useRef<number | null>(null);
  const firstAudioChunkQueuedTsRef = useRef<number | null>(null);
  const audioPlaybackStartTsRef = useRef<number | null>(null);

  // Timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (connected) {
      interval = setInterval(() => setDuration(prev => prev + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [connected]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Refs for tracking context
  const candidateIntroRef = useRef<string>("");
  const handOffTargetRef = useRef<string | null>(null);


  // ---- Latency instrumentation helpers (DEV only, safe no-ops in production) ----
  const startNewTurn = useCallback(() => {
    currentTurnIdRef.current += 1;
    userStopTsRef.current = null;
    firstTranscriptTokenTsRef.current = null;
    firstAudioChunkQueuedTsRef.current = null;
    audioPlaybackStartTsRef.current = null;
  }, []);

  const markUserAudioChunk = useCallback(() => {
    // Track last time we sent candidate audio upstream
    lastUserAudioChunkTsRef.current = performance.now();
    // While user is talking, clear any pending stop timestamp
    userStopTsRef.current = null;
  }, []);

  const maybeLogLatencyMetrics = useCallback(() => {
    const userStop = userStopTsRef.current;
    const tText = firstTranscriptTokenTsRef.current;
    const tAudioQueued = firstAudioChunkQueuedTsRef.current;
    const tAudioStart = audioPlaybackStartTsRef.current;

    if (!userStop) return;

    const turnId = currentTurnIdRef.current;
    const metrics: Record<string, number | string> = {
      turnId,
      userStopTs: userStop,
    };

    if (tText) {
      metrics.ttftTextMs = tText - userStop;
    }
    if (tAudioQueued) {
      metrics.ttftAudioQueuedMs = tAudioQueued - userStop;
    }
    if (tAudioStart) {
      metrics.panelistStartMs = tAudioStart - userStop;
    }

    // Only log once we have at least text or audio queued timing
    if (metrics.ttftTextMs || metrics.ttftAudioQueuedMs || metrics.panelistStartMs) {
      // eslint-disable-next-line no-console
      console.log("[LiveInterview][LatencyMetrics]", metrics);
    }
  }, []);


  // ... (inside handleLiveMessage)

  const generatePanelistInstruction = useCallback((panelistIndex: number, isIntro: boolean = false) => {
    const panelist = panelists[panelistIndex];
    const otherPanelists = panelists.filter((_, i) => i !== panelistIndex);
    const difficulty = candidate.difficulty || 'Medium';

    // Difficulty-specific tone and questioning style
    const difficultyGuide: Record<string, string> = {
      Easy: 'SOFT & WELCOMING: Be encouraging, patient, and forgiving. Ask foundational questions. Give hints if they struggle. Focus on potential over perfection.',
      Medium: 'PROFESSIONAL & BALANCED: Standard corporate style. Ask clear questions. Gently probe when needed. Fair but not lenient.',
      Hard: 'STRICT & PROBING: Expect detailed answers. Follow up on gaps. Challenge vague responses. High bar but still professional.',
      Extreme: 'RIGOROUS & DEMANDING: Zero fluff. Push for precision. Stress-test with edge cases. Skeptical until proven.'
    };
    const difficultyStyle = difficultyGuide[difficulty] || difficultyGuide.Medium;

    // Progressive flow: introduction → base → deep
    const flowGuidance = `
PROGRESSIVE INTERVIEW FLOW (follow this strictly):
1. INTRODUCTION: Warm greeting, put candidate at ease. Ask them to tell us about themselves. Do NOT jump to technical or deep questions.
2. BASE LEVEL: After intro, ask broad, surface-level questions in your focus area. Simple "tell me about..." or "how would you approach..." - nothing too specific yet.
3. GO DEEPER: Only after they answer base questions well, ask follow-ups that probe deeper. Lead with curiosity, not interrogation.
Keep the pace SMOOTH. Never rush from intro to deep. Let the candidate breathe between questions.
`;

    // Build conversation context from recent transcript (last 6 exchanges)
    const recentTranscript = transcriptLinesRef.current.slice(-6);
    let conversationContext = '';

    // Always include candidate introduction in context if available
    const introContext = candidateIntroRef.current
      ? `\nCANDIDATE INTRODUCTION (Reference this):\n"${candidateIntroRef.current}"\n`
      : '';

    if (recentTranscript.length > 0 && !isIntro) {
      const formattedTranscript = recentTranscript.map(line => {
        const [speaker, content] = line.split('|||');
        return `${speaker}: ${content}`;
      }).join('\n');

      conversationContext = `
RECENT CONVERSATION (build on this, don't repeat questions already asked):
${formattedTranscript}
`;
    }

    // Apply orchestration hint if available
    let strategicGuidance = '';
    if (orchestrationHint && !isIntro) {
      strategicGuidance = `

STRATEGIC GUIDANCE FROM ORCHESTRATOR:
- Suggested Topic: ${orchestrationHint.suggestedTopic}
- Depth Level: ${orchestrationHint.suggestedDepth}/5 (1=surface, 5=very deep)
- Should Follow Up: ${orchestrationHint.shouldFollowUp ? 'YES - go deeper on this topic' : 'NO - move to new topic'}
- Reasoning: ${orchestrationHint.reasoning}
`;
    }

    return `
You are ${panelist.name}, a ${panelist.role} conducting a job interview.
Your focus area: ${panelist.focus}
Your personality: ${panelist.description}

INTERVIEW DIFFICULTY (user-selected): ${difficulty}
${difficultyStyle}

${flowGuidance}

INTERVIEW CONTEXT:
- Candidate: ${candidate.name}
- Role: ${candidate.targetRole || 'Software Developer'}
- Skills: ${candidate.skills.slice(0, 5).join(', ')}
- Experience: ${candidate.experience.slice(0, 2).join('; ')}
${introContext}

OTHER PANEL MEMBERS (for context, but YOU speak alone):
${otherPanelists.map(p => `- ${p.name} (${p.role}): ${p.focus}`).join('\n')}
${conversationContext}${strategicGuidance}
CRITICAL RULES:
1. You are ONLY ${panelist.name} - never speak as anyone else
2. Keep responses concise (2-3 sentences max for questions)
3. Focus ONLY on your area: ${panelist.focus}
4. ${isIntro
        ? 'Start SOFT and WARM. Greet the candidate, introduce yourself, then ask them to tell us about themselves. Do NOT ask technical or deep questions yet.'
        : 'Match the current phase: if conversation is new, ask base-level questions. Only go deep (follow-ups, probing) after they\'ve answered well and the flow is established.'}
5. Be conversational and natural - this is a live video call
6. DO NOT repeat questions that were already asked in the conversation
7. Build on the candidate's previous answers when asking follow-ups
8. DYNAMIC HANDOFF: When passing to another panelist, say a natural transition phrase, then SILENTLY append the handoff tag at the very end. DO NOT speak the brackets or the word PASS aloud - it is silent metadata.
   - CORRECT: "That's a great point about team culture. I think Priya would love to hear more about that." (then silently append: [PASS: Priya])
   - CORRECT: "Fascinating! Alex, what do you think?" (then silently append: [PASS: Alex])
   - WRONG: "That's great. [PASS: Priya Sharma]" (DO NOT say "pass" or brackets!)
   - The tag format is: [PASS: ExactPanelistFirstName] - use ONLY the first name, not full name.

${isIntro ? `Start with: "Hi ${candidate.name}, welcome! I'm ${panelist.name}, ${panelist.role}. To start us off, could you tell us a little about yourself and your journey?"` : ''}
    `.trim();
  }, [candidate, panelists, orchestrationHint]);

  // Tier 1: Pre-warm next panelist session in background (overlapped creation)
  const preWarmNextPanelist = useCallback((nextIndex: number) => {
    if (!aiRef.current || preWarmInProgressRef.current === nextIndex) return;
    if (preWarmedSessionRef.current?.index === nextIndex && preWarmedSessionRef.current?.session) return;

    preWarmInProgressRef.current = nextIndex;
    const panelist = panelists[nextIndex];
    const voice = panelist.voiceName || PANELIST_VOICES[nextIndex % PANELIST_VOICES.length];
    const instruction = generatePanelistInstruction(nextIndex, false);
    const panelistName = panelist.name;

    aiRef.current.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config: {
        systemInstruction: instruction,
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
          languageCode: 'en-US'
        },
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
            silenceDurationMs: 2000,
          }
        }
      },
      callbacks: {
        onopen: () => {},
        onmessage: async (message: LiveServerMessage) => {
          handleLiveMessageRef.current(message, panelistName);
        },
        onclose: () => {},
        onerror: () => { preWarmInProgressRef.current = null; }
      }
    }).then((session: any) => {
      if (preWarmInProgressRef.current === nextIndex) {
        preWarmedSessionRef.current = { index: nextIndex, session };
      }
      preWarmInProgressRef.current = null;
    }).catch((err: unknown) => {
      console.warn('Pre-warm failed:', err);
      preWarmInProgressRef.current = null;
    });
  }, [panelists, generatePanelistInstruction]);

  // Switch to a different panelist session
  const switchToPanelist = useCallback(async (panelistIndex: number, isIntro: boolean = false) => {
    if (isSwitchingSessionRef.current) {
      console.log('Already switching session, skipping...');
      return;
    }

    if (!aiRef.current) {
      console.error('AI not initialized');
      return;
    }

    isSwitchingSessionRef.current = true;

    try {
      const existingSession = sessionRef.current;
      let session: any;

      // Tier 1: Use pre-warmed session if available (eliminates 1-3s connection delay)
      if (preWarmedSessionRef.current?.index === panelistIndex && preWarmedSessionRef.current?.session && !isIntro) {
        session = preWarmedSessionRef.current.session;
        preWarmedSessionRef.current = null;
        preWarmInProgressRef.current = null;
        console.log(`Using pre-warmed session for panelist: ${panelists[panelistIndex].name}`);
      } else {
        preWarmedSessionRef.current = null;
        preWarmInProgressRef.current = null;
      }

      // Close existing session (fire-and-forget when using pre-warmed)
      if (existingSession) {
        const toClose = existingSession;
        sessionRef.current = null;
        const closeResult = toClose.close();
        if (closeResult != null && typeof closeResult.catch === 'function') {
          closeResult.catch((e: unknown) => console.warn('Error closing session:', e));
        }
        await new Promise<void>(resolve => queueMicrotask(() => resolve()));
      }

      const panelist = panelists[panelistIndex];
      const voice = panelist.voiceName || PANELIST_VOICES[panelistIndex % PANELIST_VOICES.length];

      if (!session) {
        const instruction = generatePanelistInstruction(panelistIndex, isIntro);
        console.log(`Switching to panelist: ${panelist.name} with voice: ${voice}`);

        session = await aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: instruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } },
            languageCode: 'en-US'
          },
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_LOW,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_LOW,
              silenceDurationMs: 2000,
            }
          }
        },
        callbacks: {
          onopen: () => {
            console.log('[LiveInterview] Gemini session connected:', panelist.name);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleLiveMessage(message, panelist.name);
          },
          onclose: () => {
            console.log('[LiveInterview] Gemini session closed:', panelist.name);
          },
          onerror: (err) => {
            console.error('[LiveInterview] Gemini session error:', panelist.name, err);
          }
        }
      });
      }

      currentPanelistRef.current = panelistIndex;
      setCurrentPanelistIndex(panelistIndex);
      setActiveSpeaker(panelist.name);
      sessionRef.current = session;
      lastSpeakerChangeRef.current = Date.now();
      console.log('[LiveInterview] Session active, sessionRef set. Ready for audio.');

      // Trigger model to start speaking
      if (isIntro) {
        console.log('[LiveInterview] Sending initial trigger for intro via sendClientContent');
        try {
          session.sendClientContent({ turns: 'Please introduce yourself warmly and begin the interview. Start with a greeting, then ask the candidate to tell us about themselves. Keep it soft and welcoming—do not dive into technical or deep questions yet.', turnComplete: true });
        } catch (e) {
          console.warn('[LiveInterview] Failed to send initial trigger:', e);
        }
      } else {
        // After panelist switch: provide conversation context and prompt to continue
        const recentLines = transcriptLinesRef.current.slice(-4).map(line => {
          const [speaker, ...rest] = line.split('|||');
          return `${speaker}: ${rest.join('|||')}`;
        }).join('\n');
        const diff = candidate.difficulty || 'Medium';
        const prompt = recentLines
          ? `Here is the recent conversation:\n${recentLines}\n\nContinue the interview naturally. Follow the progressive flow (intro → base → deep). Match the ${diff} difficulty. Ask your next question in your focus area.`
          : `Continue the interview. Match the ${diff} difficulty. Ask a base-level question in your focus area.`;
        console.log(`[LiveInterview] Sending continuation trigger for ${panelist.name}`);
        try {
          session.sendClientContent({ turns: prompt, turnComplete: true });
        } catch (e) {
          console.warn('[LiveInterview] Failed to send continuation trigger:', e);
        }
      }

    } catch (error) {
      console.error('[LiveInterview] Failed to switch panelist:', error);
    } finally {
      isSwitchingSessionRef.current = false;
    }
  }, [panelists, generatePanelistInstruction]);



  // Start Session - initialize with first panelist
  const startSession = async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not set in environment");
      console.log('[LiveInterview] Starting session, API key present:', !!apiKey);

      const ai = new GoogleGenAI({ apiKey });
      aiRef.current = ai;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;

      // Crossfade gain node for smooth panelist transitions (Tier 3 optimization)
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 1;
      gainNode.connect(audioCtx.destination);
      audioGainRef.current = gainNode;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;

      // Debug: log panelist voice assignments
      console.log('[LiveInterview] Panelists:', panelists.map(p => `${p.name} -> voiceName: ${p.voiceName || 'MISSING (using fallback)'}`));

      // Connect to orchestration WebSocket
      connectOrchestrationWebSocket();

      // Start with first panelist using switchToPanelist
      await switchToPanelist(0, true);
      setConnected(true);
      console.log('[LiveInterview] First panelist connected, starting media streaming');

      // Start media streaming after session is ready
      await startMediaStreaming();
      console.log('[LiveInterview] Media streaming started');

    } catch (e) {
      console.error("[LiveInterview] Failed to start session:", e);
    }
  };

  // Connect to orchestration WebSocket
  const connectOrchestrationWebSocket = () => {
    // Use same origin in production (nginx proxies /ws to backend)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/interview`;
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('Orchestration WebSocket connected');
      // Initialize session
      ws.send(JSON.stringify({
        type: 'init',
        data: { candidate, panelists }
      }));
    };

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'orchestration_hint') {
          console.log('Received orchestration hint:', message.data);
          setOrchestrationHint(message.data);
        } else if (message.type === 'interview_phase_change') {
          console.log('Phase change:', message.data);
          const { phase, shouldStartClosing } = message.data;
          setInterviewPhase(phase);

          // Show single toast when entering closing phase
          if (shouldStartClosing && !showClosingToast) {
            setShowClosingToast(true);
            // Auto-hide toast after 5 seconds
            setTimeout(() => setShowClosingToast(false), 5000);
          }
        } else if (message.type === 'interview_complete') {
          console.log('Interview completed:', message.data);
          setInterviewPhase('completed');
          // Auto-stop interview after brief delay
          setTimeout(() => stopInterview(), 1000);
        } else if (message.type === 'time_update') {
          const { remainingSeconds } = message.data;
          setRemainingTime(remainingSeconds);
        }
      } catch (error) {
        console.error('Error parsing orchestration message:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('Orchestration WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('Orchestration WebSocket closed');
    };

    orchestrationWsRef.current = ws;
  };

  // Send transcript update to orchestration server (throttled for performance)
  const sendTranscriptUpdate = useCallback((speaker: 'user' | 'ai', text: string, panelistName?: string) => {
    const now = Date.now();

    // Throttle updates to reduce network overhead
    if (now - lastOrchestrationUpdateRef.current < ORCHESTRATION_THROTTLE_MS) {
      return; // Skip this update
    }

    lastOrchestrationUpdateRef.current = now;

    if (orchestrationWsRef.current?.readyState === WebSocket.OPEN) {
      orchestrationWsRef.current.send(JSON.stringify({
        type: 'transcript_update',
        data: {
          speaker,
          text,
          timestamp: now,
          panelistName
        }
      }));
    }
  }, []);

  // Tier 5: Send speech_end to trigger immediate hint generation (bypasses throttle)
  const sendSpeechEnd = useCallback((transcript?: string) => {
    if (orchestrationWsRef.current?.readyState === WebSocket.OPEN) {
      orchestrationWsRef.current.send(JSON.stringify({
        type: 'speech_end',
        data: transcript ? { transcript } : {}
      }));
    }
  }, []);

  // Tier 2: Client-side VAD for faster end-of-speech detection
  useVAD({
    enabled: connected,
    stream: mediaStream,
    onSpeechEnd: () => {
      userStopTsRef.current = performance.now();
      sendSpeechEnd();
    },
    onSpeechStart: () => {
      userStopTsRef.current = null;
    },
  });

  const startMediaStreaming = async () => {
    try {
      // Reuse existing stream if already requested (e.g. on mount for setup)
      let stream = streamRef.current;
      if (!stream) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: true,
            autoGainControl: true,
            noiseSuppression: true
          },
          video: true
        });
        streamRef.current = stream;
        setMediaStream(stream);
        setMicPermission(true);
        setCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }

      // 1. Audio Streaming
      // 1. Audio Streaming
      const inputCtx = inputContextRef.current!;

      // Load the AudioWorklet module
      try {
        // Try adding module (using relative path from public root)
        await inputCtx.audioWorklet.addModule('/worklets/audio-processor.js');
        const source = inputCtx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(inputCtx, 'audio-processor');

        let audioChunkCount = 0;
        workletNode.port.onmessage = (event) => {
          const inputData = event.data;
          // Create PCM blob from the raw float32 data (input is 16kHz from context)
          const pcmBlob = createPcmBlob(inputData, 16000);

          if (sessionRef.current) {
            markUserAudioChunk();
            sessionRef.current.sendRealtimeInput({ media: pcmBlob });
            if (++audioChunkCount <= 3 || audioChunkCount % 100 === 0) {
              console.log('[LiveInterview] Sent user audio chunk to Gemini:', audioChunkCount);
            }
          } else if (audioChunkCount === 0) {
            console.warn('[LiveInterview] No sessionRef when sending audio - session may not be ready');
          }
        };

        source.connect(workletNode);

        // Keep graph alive with silent output
        const silentGain = inputCtx.createGain();
        silentGain.gain.value = 0;
        workletNode.connect(silentGain);
        silentGain.connect(inputCtx.destination);

        // Cleanup storage
        processorRef.current = workletNode as any;

      } catch (err) {
        console.error('Failed to load audio worklet, falling back to ScriptProcessor:', err);
        // Fallback to ScriptProcessor if Worklet fails
        const source = inputCtx.createMediaStreamSource(stream);
        // Phase 2: Reduced buffer size from 1024 to 512 for lower latency
        const processor = inputCtx.createScriptProcessor(512, 1, 1);
        processorRef.current = processor;

        let fallbackChunkCount = 0;
        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob = createPcmBlob(inputData, 16000);
          if (sessionRef.current) {
            markUserAudioChunk();
            sessionRef.current.sendRealtimeInput({ media: pcmBlob });
            if (++fallbackChunkCount <= 3) console.log('[LiveInterview] ScriptProcessor: sent audio chunk', fallbackChunkCount);
          } else if (fallbackChunkCount === 0) {
            console.warn('[LiveInterview] ScriptProcessor: no sessionRef');
          }
        };

        source.connect(processor);
        const silentGain = inputCtx.createGain();
        silentGain.gain.value = 0;
        processor.connect(silentGain);
        silentGain.connect(inputCtx.destination);
      }

      // 2. Video Streaming
      videoIntervalRef.current = window.setInterval(() => {
        if (!canvasRef.current || !videoRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = videoRef.current.videoWidth / 4;
        canvasRef.current.height = videoRef.current.videoHeight / 4;
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];

        // Use current session directly from ref
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64 } });
        }
      }, 2000); // Phase 3: Increased from 1000ms to 2000ms to reduce overhead

    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const processAudioQueue = async () => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx || audioQueueRef.current.length === 0) return;
    if (interruptedRef.current) {
      audioQueueRef.current = [];
      preDecodedBuffersRef.current = [];
      return;
    }
    // Strict sequential playback - never start next until current ends
    if (isPlayingAudioRef.current) return;

    isPlayingAudioRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    try {
      // Phase 3 + Tier 6: Use pre-decoded buffer if available, otherwise decode now
      let audioBuffer: AudioBuffer;
      if (preDecodedBuffersRef.current.length > 0) {
        audioBuffer = preDecodedBuffersRef.current.shift()!;
      } else {
        audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), audioCtx, 24000);
      }

      if (interruptedRef.current) return;

      // Tier 6: Pre-decode up to 3 chunks ahead while current plays
      const toPreDecode = Math.min(3 - preDecodedBuffersRef.current.length, audioQueueRef.current.length);
      for (let i = 0; i < toPreDecode && !interruptedRef.current; i++) {
        const nextAudioData = audioQueueRef.current[i];
        if (nextAudioData) {
          decodeAudioData(base64ToUint8Array(nextAudioData), audioCtx, 24000)
            .then(buffer => {
              if (!interruptedRef.current) {
                preDecodedBuffersRef.current.push(buffer);
              }
            })
            .catch(err => console.warn('Pre-decode failed:', err));
        }
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      currentSourceRef.current = source;

      // Connect via gain node for smooth crossfade between panelists (Tier 3)
      const outputGain = audioGainRef.current;
      if (outputGain) {
        source.connect(outputGain);
      } else {
        source.connect(audioCtx.destination);
      }

      const startTime = Math.max(audioCtx.currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      // Mark when panelist audio actually starts playing for this turn
      if (!audioPlaybackStartTsRef.current) {
        audioPlaybackStartTsRef.current = performance.now();
        maybeLogLatencyMetrics();
      }

      source.onended = () => {
        currentSourceRef.current = null;
        isPlayingAudioRef.current = false;

        // Check if all audio in queue is done
        if (audioQueueRef.current.length === 0) {
          setIsTalking(false);

          // Increment question count and check for panelist rotation
          questionCountRef.current += 1;

          // Tier 1: Pre-warm next panelist for fallback rotation (after first question)
          if (questionCountRef.current === 1) {
            const nextIndex = (currentPanelistRef.current + 1) % panelists.length;
            preWarmNextPanelist(nextIndex);
          }

          // PRIORITY 1: Check for AI-driven dynamic handoff first
          if (handOffTargetRef.current) {
            console.log(`Executing dynamic handoff to: ${handOffTargetRef.current}`);
            const targetName = handOffTargetRef.current.toLowerCase();
            handOffTargetRef.current = null; // Clear it

            // Try exact match first, then first-name match
            let nextIndex = panelists.findIndex(p => p.name.toLowerCase() === targetName);
            if (nextIndex === -1) {
              // Try matching just the first name
              nextIndex = panelists.findIndex(p => p.name.toLowerCase().startsWith(targetName) || targetName.includes(p.name.split(' ')[0].toLowerCase()));
            }

            if (nextIndex !== -1 && nextIndex !== currentPanelistRef.current) {
              console.log(`Switching to panelist: ${panelists[nextIndex].name}`);
              questionCountRef.current = 0;
              setTimeout(() => switchToPanelist(nextIndex, false), 50);
              return;
            } else {
              console.log(`Could not find panelist matching: ${targetName}`);
            }
          }

          // PRIORITY 2: Fallback rotation after 4-5 questions
          // Also ensure minimum 5 seconds between switches
          const timeSinceLastSwitch = Date.now() - lastSpeakerChangeRef.current;
          if (questionCountRef.current >= 4 && timeSinceLastSwitch > 5000) {
            questionCountRef.current = 0;
            const nextIndex = (currentPanelistRef.current + 1) % panelists.length;

            // Schedule switch with minimal pause for natural handoff (Tier 3: 800ms -> 100ms)
            setTimeout(() => {
              switchToPanelist(nextIndex, false);
            }, 100);
          }
        } else {
          // More audio chunks to play
          processAudioQueue();
        }
      };
    } catch (err) {
      console.error('Audio playback error:', err);
      isPlayingAudioRef.current = false;
      if (audioQueueRef.current.length > 0) processAudioQueue();
    }
  };

  // Handle messages from Gemini Live with known panelist name
  const handleLiveMessage = async (message: LiveServerMessage, panelistName?: string) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) {
      console.warn('[LiveInterview] handleLiveMessage: no audioCtx, skipping');
      return;
    }

    // Debug: log message structure
    const count = ++handleLiveMessageCountRef.current;
    const sc = (message as any).serverContent;
    const msgKeys = sc ? Object.keys(sc) : [];
    const hasInputTrans = !!sc?.inputTranscription;
    const hasOutputTrans = !!sc?.outputTranscription;
    const hasAudio = !!(sc?.modelTurn?.parts?.length);
    const hasInterrupted = !!sc?.interrupted;
    if (count <= 15 || hasInputTrans || hasOutputTrans || hasAudio) {
      console.log(`[LiveInterview] Message #${count} serverContent keys:`, msgKeys, {
        inputTranscription: hasInputTrans ? { text: sc?.inputTranscription?.text?.slice(0, 80), finished: sc?.inputTranscription?.finished } : undefined,
        outputTranscription: hasOutputTrans ? { text: sc?.outputTranscription?.text?.slice(0, 80) } : undefined,
        audioParts: sc?.modelTurn?.parts?.length ?? 0,
        interrupted: hasInterrupted,
      });
    }
    if (msgKeys.length === 0 && count <= 5) {
      console.log('[LiveInterview] Message has no serverContent. Full message:', JSON.stringify(message)?.slice(0, 300));
    }

    // Tier 7: Process audio first for lowest latency - start playback before transcript updates
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const audioData = part?.inlineData?.data;
      if (audioData) {
        if (audioQueueRef.current.length === 0 && !isPlayingAudioRef.current) {
          startNewTurn();
        }
        setIsTalking(true);
        audioQueueRef.current.push(audioData);
        if (!firstAudioChunkQueuedTsRef.current) {
          const now = performance.now();
          if (!userStopTsRef.current) {
            userStopTsRef.current = lastUserAudioChunkTsRef.current ?? now;
          }
          firstAudioChunkQueuedTsRef.current = now;
          maybeLogLatencyMetrics();
        }
      }
    }
    if (audioQueueRef.current.length > 0) processAudioQueue();

    // Handle user's speech (inputTranscription) - live user transcription
    const inputTrans = message.serverContent?.inputTranscription;
    if (inputTrans) {
      console.log('[LiveInterview] inputTranscription:', { text: inputTrans.text?.slice(0, 80), finished: inputTrans.finished });
    }
    if (inputTrans?.text !== undefined) {
      const text = inputTrans.text.trim();
      if (text) {
        // When user starts speaking, finalize any in-progress AI line (turn boundary)
        if (!currentUserLineRef.current && currentLineRef.current) {
          transcriptLinesRef.current.push(`${currentLineRef.current.speaker}|||${currentLineRef.current.content}`);
          sendTranscriptUpdate('ai', currentLineRef.current.content, currentLineRef.current.speaker);
          currentLineRef.current = null;
        }

        // Gemini can send either CUMULATIVE (full text so far) or INCREMENTAL (new chunk only).
        const lastSeg = lastSegmentTextRef.current;
        const isNewSegment = !lastSeg;

        if (isNewSegment) {
          // New segment: record where it starts in the accumulated text
          segmentStartLenRef.current = currentUserLineRef.current.length;
          const prefix = currentUserLineRef.current ? currentUserLineRef.current + ' ' : '';
          currentUserLineRef.current = prefix + text;
          lastSegmentTextRef.current = text;
        } else if (text === lastSeg) {
          // Duplicate - ignore
        } else if (lastSeg && text.startsWith(lastSeg) && text.length > lastSeg.length) {
          // CUMULATIVE: Gemini sent full text so far - replace segment with full text
          const base = currentUserLineRef.current.slice(0, segmentStartLenRef.current);
          currentUserLineRef.current = (base ? base + ' ' : '') + text;
          lastSegmentTextRef.current = text;
        } else {
          // INCREMENTAL: Gemini sent a new chunk only - append without adding space
          // (Gemini may send "stu"+"dent" for "student" - adding space would break words)
          const base = currentUserLineRef.current.slice(0, segmentStartLenRef.current);
          const existingSegment = currentUserLineRef.current.slice(segmentStartLenRef.current);
          const toAppend = existingSegment + text;
          currentUserLineRef.current = (base ? base + ' ' : '') + toAppend.trim();
          lastSegmentTextRef.current = toAppend.trim();
        }
      }
      if (inputTrans.finished) {
        // DON'T finalize here - keep accumulating until AI starts speaking.
        // Just reset segment tracking so next segment appends correctly.
        lastSegmentTextRef.current = '';
        segmentStartLenRef.current = 0;
        // Mark that user has spoken (for turn boundary detection)
        if (currentUserLineRef.current.trim()) {
          turnBoundaryRef.current = true;
        }
      }
      const newTranscript = [
        ...transcriptLinesRef.current,
        currentUserLineRef.current ? `You|||${currentUserLineRef.current}` : '',
        currentLineRef.current ? `${currentLineRef.current.speaker}|||${currentLineRef.current.content}` : ''
      ].filter(Boolean);
      pendingTranscriptUpdateRef.current = newTranscript;
      if (rafIdRef.current === null) {
        rafIdRef.current = requestAnimationFrame(() => {
          if (pendingTranscriptUpdateRef.current) {
            setTranscript(pendingTranscriptUpdateRef.current);
            pendingTranscriptUpdateRef.current = null;
            setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
          rafIdRef.current = null;
        });
      }
    }

    // Handle AI's speech (outputTranscription) - what the panelist is saying
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text?.trim();
      console.log('[LiveInterview] outputTranscription:', text?.slice(0, 80));
      if (text) {
        // Use provided panelist name (from session) or extract from text prefix
        const match = text.match(/^\[([^\]]+)\]:?\s*/);
        let speaker = panelistName || match?.[1]?.trim() || panelists[currentPanelistRef.current]?.name || 'Panel';
        let content = text.replace(/^\[[^\]]+\]:?\s*/, '').trim();

        // Check for dynamic handoff token [PASS: Name]
        const passMatch = content.match(/\[PASS:\s*([^\]]+)\]/i);
        if (passMatch) {
          const targetName = passMatch[1].trim();
          if (!handOffTargetRef.current) {
            handOffTargetRef.current = targetName;
            // Tier 1: Pre-warm target panelist session while AI is still speaking
            let nextIndex = panelists.findIndex(p => p.name.toLowerCase() === targetName.toLowerCase());
            if (nextIndex === -1) {
              nextIndex = panelists.findIndex(p => p.name.toLowerCase().startsWith(targetName.toLowerCase()) || targetName.toLowerCase().includes(p.name.split(' ')[0].toLowerCase()));
            }
            if (nextIndex !== -1 && nextIndex !== currentPanelistRef.current) {
              preWarmNextPanelist(nextIndex);
            }
          }
          // Remove the token from display text
          content = content.replace(/\[PASS:\s*[^\]]+\]/gi, '').trim();
        }

        // Update active speaker indicator to the known panelist
        setActiveSpeaker(speaker);

        // Check if this is a continuation of the current speaker AND no turn boundary
        const isSameSpeaker = currentLineRef.current?.speaker === speaker;
        const hasTurnBoundary = turnBoundaryRef.current;

        if (isSameSpeaker && !hasTurnBoundary) {
          const currentContent = currentLineRef.current!.content;

          // Gemini sends cumulative text - check if new text starts with current content
          if (content.startsWith(currentContent) && content.length > currentContent.length) {
            // Cumulative update - replace with full text
            currentLineRef.current!.content = content;
          } else if (!currentContent.includes(content) && content.length > 0) {
            // New chunk - append with space
            currentLineRef.current!.content = currentContent + (currentContent ? ' ' : '') + content;
          }
          // Otherwise it's a duplicate - ignore
        } else {
          // New speaker OR turn boundary (user spoke in between) - save previous line and start new one
          turnBoundaryRef.current = false;

          if (currentLineRef.current) {
            const finalizedLine = `${currentLineRef.current.speaker}|||${currentLineRef.current.content}`;
            transcriptLinesRef.current.push(finalizedLine);

            // Send to orchestration server
            sendTranscriptUpdate('ai', currentLineRef.current.content, currentLineRef.current.speaker);
          }
          // Finalize any in-progress user line when AI starts speaking
          if (currentUserLineRef.current.trim()) {
            transcriptLinesRef.current.push(`You|||${currentUserLineRef.current.trim()}`);
            sendTranscriptUpdate('user', currentUserLineRef.current.trim());
            currentUserLineRef.current = '';
            lastSegmentTextRef.current = '';
          }
          currentLineRef.current = { speaker, content, prefix: '' };
        }

        // Phase 2: Batch transcript updates using requestAnimationFrame (include live user line if any)
        const newTranscript = [
          ...transcriptLinesRef.current,
          currentUserLineRef.current ? `You|||${currentUserLineRef.current}` : '',
          currentLineRef.current ? `${currentLineRef.current.speaker}|||${currentLineRef.current.content}` : ''
        ].filter(Boolean);

        pendingTranscriptUpdateRef.current = newTranscript;

        if (rafIdRef.current === null) {
          rafIdRef.current = requestAnimationFrame(() => {
            if (pendingTranscriptUpdateRef.current) {
              setTranscript(pendingTranscriptUpdateRef.current);
              pendingTranscriptUpdateRef.current = null;
              // Auto-scroll to bottom
              setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
            }
            rafIdRef.current = null;
          });
        }

        // Latency: record first transcript token timing for this turn
        const now = performance.now();
        if (!firstTranscriptTokenTsRef.current) {
          // Approximate user stop as last audio chunk sent before first AI text
          userStopTsRef.current = lastUserAudioChunkTsRef.current ?? now;
          firstTranscriptTokenTsRef.current = now;
          maybeLogLatencyMetrics();
        }
      }
    }

    if (message.serverContent?.interrupted) {
      interruptedRef.current = true;
      currentSourceRef.current?.stop();
      currentSourceRef.current = null;
      audioQueueRef.current = [];
      preDecodedBuffersRef.current = [];
      currentUserLineRef.current = '';
      lastSegmentTextRef.current = '';
      nextStartTimeRef.current = audioCtx.currentTime;
      isPlayingAudioRef.current = false;
      setIsTalking(false);
      interruptedRef.current = false;
    }
  };

  useEffect(() => {
    handleLiveMessageRef.current = handleLiveMessage;
  });

  const cleanupResources = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (processorRef.current) processorRef.current.disconnect();
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (sessionRef.current) {
      const closeResult = sessionRef.current.close();
      if (closeResult != null && typeof closeResult.catch === 'function') {
        closeResult.catch(() => {});
      }
      sessionRef.current = null;
    }
    if (audioContextRef.current?.state !== 'closed') {
      const acClose = audioContextRef.current.close();
      if (acClose != null && typeof acClose.catch === 'function') acClose.catch(console.error);
    }
    if (inputContextRef.current?.state !== 'closed') {
      const icClose = inputContextRef.current.close();
      if (icClose != null && typeof icClose.catch === 'function') icClose.catch(console.error);
    }

    // Close pre-warmed session if any (Tier 1)
    if (preWarmedSessionRef.current?.session) {
      const closeResult = preWarmedSessionRef.current.session.close();
      if (closeResult != null && typeof closeResult.catch === 'function') {
        closeResult.catch(() => {});
      }
      preWarmedSessionRef.current = null;
    }
    preWarmInProgressRef.current = null;

    // Close orchestration WebSocket
    if (orchestrationWsRef.current?.readyState === WebSocket.OPEN) {
      orchestrationWsRef.current.close();
    }
  };

  const stopInterview = () => {
    // Optional: log final aggregated latency info at end of interview
    try {
      maybeLogLatencyMetrics();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn("[LiveInterview] Error logging latency metrics on stop:", err);
    }

    // Finalize any in-progress lines before sending transcript
    if (currentUserLineRef.current.trim()) {
      transcriptLinesRef.current.push(`You|||${currentUserLineRef.current.trim()}`);
      currentUserLineRef.current = '';
      lastSegmentTextRef.current = '';
    }
    if (currentLineRef.current) {
      transcriptLinesRef.current.push(`${currentLineRef.current.speaker}|||${currentLineRef.current.content}`);
      currentLineRef.current = null;
    }
    // Use the finalized ref-based transcript (more complete than React state)
    const finalTranscript = transcriptLinesRef.current;

    cleanupResources();
    onFinish(finalTranscript.join('\n'), duration, bodyLanguageHistory, emotionHistory);
  };

  const toggleMic = () => {
    if (!streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    if (!streamRef.current) return;
    const videoTrack = streamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCameraOff(!videoTrack.enabled);
    }
  };

  // Request camera/mic on mount so user can set up before clicking Start
  const mediaSetupRef = useRef(false);
  useEffect(() => {
    if (mediaSetupRef.current) return;
    mediaSetupRef.current = true;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true },
          video: true
        });
        streamRef.current = stream;
        setMediaStream(stream);
        setMicPermission(true);
        setCameraPermission(true);
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch (err) {
        console.error('Failed to get media devices:', err);
      }
    })();
  }, []);

  // Guard against React StrictMode double-mount destroying the live session
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!readyToStart) return;
    if (mountedRef.current) return; // Already started in StrictMode first mount
    mountedRef.current = true;
    startSession();
    return () => {
      // In StrictMode dev, this fires between the two mounts.
      // Do NOT clean up here — only clean up on actual unmount (stopInterview).
      // The ref guard above prevents a second startSession on re-mount.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToStart]);

  // Video Analysis Hook
  useVideoAnalysis({
    stream: mediaStream,
    isRecording: connected && !cameraOff, // Only record when connected and camera is on
    onAnalysisResult: (type, data) => {
      // console.log(`[Analysis] ${type}:`, data);
      if (type === 'body_language') {
        setBodyLanguageHistory(prev => [...prev, data]);
      } else if (type === 'emotion') {
        setEmotionHistory(prev => [...prev, data]);
      }
    }
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="h-[calc(100vh-6rem)] w-full px-6 grid grid-cols-[15%_1fr_25%] gap-6 overflow-hidden relative py-6"
    >
      {/* Overlay: Ready to Begin - after setup, before AI starts */}
      {!readyToStart && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-2xl">
          <div className="glass rounded-2xl border border-white/20 p-10 max-w-lg w-full text-center shadow-2xl shadow-black/30">
            <h2 className="text-2xl font-semibold text-gray-200 mb-3">Ready to Begin?</h2>
            <p className="text-muted-foreground mb-6 text-sm leading-relaxed">
              Make sure your camera and microphone are working. The AI panel will start once you click the button below.
            </p>

            <div className="flex items-center justify-center gap-6 mb-8 text-sm text-gray-400">
              <div className="flex items-center gap-2">
                <Video className="w-4 h-4" />
                <span>Camera</span>
              </div>
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4" />
                <span>Microphone</span>
              </div>
            </div>

            <button
              onClick={() => setReadyToStart(true)}
              className="px-8 py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-full font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-primary/30"
            >
              Start Interview
            </button>
          </div>
        </div>
      )}

      {/* Left: 15% - Panelists */}
      <div className="min-w-0 min-h-0 flex flex-col gap-4 h-full">
        {panelists.map((p) => {
          const colorClasses = AVATAR_COLOR_CLASSES[p.avatarColor as AvatarColor] || AVATAR_COLOR_CLASSES.blue;
          return (
            <div
              key={p.id}
              className="flex-1 min-h-[80px] glass rounded-xl border border-white/20 p-4 flex flex-col items-center justify-center gap-2 shadow-lg shadow-black/20"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-lg font-semibold text-white shadow-sm shrink-0 transition-all duration-300 ${colorClasses.bg} ${activeSpeaker.includes(p.name) ? 'ring-4 ring-primary scale-110 shadow-lg shadow-primary/30' : ''}`}
              >
                {p.name[0]}
              </div>
              <p className={`text-sm font-medium text-center truncate w-full ${activeSpeaker.includes(p.name) ? 'text-primary' : 'text-gray-200'}`}>
                {p.name}
              </p>
              <p className="text-xs text-gray-400 text-center truncate w-full">{p.role}</p>
            </div>
          );
        })}
      </div>

      {/* Center: Camera feed */}
      <div className="min-w-0 min-h-0 flex flex-col gap-4 h-full">
        {/* Monitoring notice - above camera feed */}
        <div className="flex justify-center shrink-0">
          <div className="glass px-4 py-2.5 rounded-xl flex items-center gap-2 text-gray-400 text-xs border border-white/20">
            <Eye className="w-3.5 h-3.5 text-primary/80 shrink-0" />
            <span>Speak clearly, look confident, and maintain good posture. You're being evaluated on technical depth, communication clarity, confidence, and cultural fit.</span>
          </div>
        </div>

        <div className="relative flex-1 min-h-0 rounded-2xl overflow-hidden bg-black/90 shadow-2xl shadow-black/30 border border-white/20 group">
          {/* User Video */}
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className={`w-full h-full object-cover transform scale-x-[-1] transition-opacity duration-300 ${cameraOff ? 'opacity-0' : 'opacity-100'}`}
          />
          {cameraOff && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 text-gray-400 gap-3">
              <VideoOff className="w-16 h-16 opacity-60" />
              <p className="text-sm font-medium">Camera off</p>
              <p className="text-xs opacity-70">Click the camera button to turn it back on</p>
            </div>
          )}
          <canvas ref={canvasRef} className="hidden" />

          {/* AI Overlay / Visualizer */}
          <div className="absolute top-6 left-6 right-6 flex justify-between items-start z-10">
            <div className="glass px-5 py-2.5 rounded-xl flex items-center gap-3 text-gray-200 border border-white/20">
              <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
              <span className="text-sm font-medium tracking-wide">
                {connected ? 'LIVE' : 'CONNECTING...'}
              </span>
              <span className="text-muted-foreground/50 px-2 mx-1">|</span>
              <span className="font-mono text-sm">{formatTime(duration)}</span>
            </div>

            {/* Time Remaining Display */}
            <div className={`glass px-5 py-2.5 rounded-xl border transition-all duration-500 ${remainingTime <= 180
              ? 'border-red-500/50 bg-red-500/5 animate-pulse'
              : remainingTime <= 300
                ? 'border-yellow-500/40 bg-yellow-500/5'
                : 'border-white/20'
              }`}>
              <div className="flex items-center gap-2.5">
                <svg
                  className={`w-4 h-4 transition-colors duration-500 ${remainingTime <= 180 ? 'text-red-400' : remainingTime <= 300 ? 'text-yellow-400' : 'text-gray-400'
                    }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className={`font-mono text-sm font-medium transition-colors duration-500 ${remainingTime <= 180 ? 'text-red-400' : remainingTime <= 300 ? 'text-yellow-400' : 'text-gray-200'
                  }`}>
                  {Math.floor(remainingTime / 60)}:{(remainingTime % 60).toString().padStart(2, '0')}
                </span>
                <span className={`text-xs transition-colors duration-500 ${remainingTime <= 180 ? 'text-red-400/70' : remainingTime <= 300 ? 'text-yellow-400/70' : 'text-gray-400'
                  }`}>
                  left
                </span>
              </div>
            </div>
          </div>

          <div className="glass px-5 py-2.5 rounded-xl text-gray-200 flex items-center gap-2 border border-white/20">
            <Activity className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{activeSpeaker}</span>
          </div>

          {/* Floating Controls */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-20">
            <div className="h-14 glass rounded-2xl px-6 flex items-center gap-5 shadow-2xl shadow-black/30 border border-white/20">
              <button
                type="button"
                onClick={toggleMic}
                title={micMuted ? 'Unmute microphone' : 'Mute microphone'}
                className={`p-3 rounded-full transition-all ${micMuted || !micPermission ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : 'bg-white/10 hover:bg-white/20 text-gray-200'}`}
              >
                {micMuted || !micPermission ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                type="button"
                onClick={toggleCamera}
                title={cameraOff ? 'Turn camera on' : 'Turn camera off'}
                className={`p-3 rounded-full transition-all ${cameraOff || !cameraPermission ? 'bg-destructive/20 text-destructive hover:bg-destructive/30' : 'bg-white/10 hover:bg-white/20 text-gray-200'}`}
              >
                {cameraOff || !cameraPermission ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
              </button>
              <div className="w-px h-6 bg-border" />
              <button
                onClick={stopInterview}
                className="px-6 py-2.5 bg-destructive hover:bg-destructive/90 text-destructive-foreground rounded-full font-medium transition-all hover:scale-105 active:scale-95 flex items-center gap-2 shadow-lg shadow-destructive/20"
              >
                <PhoneOff className="w-4 h-4" />
                <span>End Call</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: 25% - Live transcript */}
      <div className="min-w-0 min-h-0 flex flex-col h-full">
        <div className="flex-1 min-h-0 glass rounded-xl border border-white/20 p-5 shadow-lg shadow-black/20 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-2 mb-4 text-gray-400 px-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Live Transcript</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 panel-style-textarea">
            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 px-4">
                <p className="text-sm">Conversation will appear here</p>
              </div>
            )}
            {transcript.map((line, idx) => {
              // Parse speaker|||content format
              const [speaker, ...contentParts] = line.split('|||');
              const content = contentParts.join('|||'); // Handle ||| in content
              const isUser = speaker === 'You';

              return (
                <div
                  key={idx}
                  className={`p-3 rounded-xl text-sm leading-relaxed max-w-full break-words ${isUser ? 'bg-primary/10 text-gray-200 ml-auto rounded-tr-sm' : 'bg-white/[0.06] text-gray-300 mr-auto rounded-tl-sm border border-white/10'}`}
                >
                  <span className="opacity-70 text-xs block mb-1 font-medium">{speaker}</span>
                  <div className="whitespace-pre-wrap">{content}</div>
                </div>
              );
            })}
            {/* Auto-scroll anchor */}
            <div ref={transcriptEndRef} />
          </div>
        </div>
      </div>

      {/* NEW: Closing Phase Toast */}
      <AnimatePresence>
        {showClosingToast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50"
          >
            <div className="glass px-6 py-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 backdrop-blur-xl">
              <div className="flex items-center gap-3 text-yellow-400">
                <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                <span className="text-sm font-medium">Interview entering final 3 minutes</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div >
  );
};
