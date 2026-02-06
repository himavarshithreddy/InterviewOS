import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Activity, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '@/utils/audioUtils';
import { CandidateProfile, Panelist, AvatarColor } from '@/types';
import { AVATAR_COLOR_CLASSES } from '@/src/constants';

// Distinct voices for each panelist - Gemini Live supported voices
const PANELIST_VOICES = ['Kore', 'Charon', 'Fenrir', 'Aoede', 'Puck'] as const;

interface Props {
  candidate: CandidateProfile;
  panelists: Panelist[];
  onFinish: (transcriptSummary: string, durationSeconds: number) => void;
}

export const LiveInterview: React.FC<Props> = ({ candidate, panelists, onFinish }) => {
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
  // Refs for transcript accumulation (avoids race when word-by-word chunks arrive rapidly)
  const transcriptLinesRef = useRef<string[]>([]);
  const currentLineRef = useRef<{ speaker: string; content: string; prefix: string } | null>(null);
  const lastAppendedChunksRef = useRef<string[]>([]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Turn-taking management
  const aiRef = useRef<GoogleGenAI | null>(null);
  const currentPanelistRef = useRef<number>(0);
  const isSwitchingSessionRef = useRef(false);
  const pendingResponseRef = useRef(false);
  const lastSpeakerChangeRef = useRef<number>(Date.now());
  const questionCountRef = useRef<number>(0);

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


  // ... (inside handleLiveMessage)

  const generatePanelistInstruction = useCallback((panelistIndex: number, isIntro: boolean = false) => {
    const panelist = panelists[panelistIndex];
    const otherPanelists = panelists.filter((_, i) => i !== panelistIndex);

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

    return `
You are ${panelist.name}, a ${panelist.role} conducting a job interview.
Your focus area: ${panelist.focus}
Your personality: ${panelist.description}

INTERVIEW CONTEXT:
- Candidate: ${candidate.name}
- Role: ${candidate.targetRole || 'Software Developer'}
- Skills: ${candidate.skills.slice(0, 5).join(', ')}
- Experience: ${candidate.experience.slice(0, 2).join('; ')}
${introContext}

OTHER PANEL MEMBERS (for context, but YOU speak alone):
${otherPanelists.map(p => `- ${p.name} (${p.role}): ${p.focus}`).join('\n')}
${conversationContext}
CRITICAL RULES:
1. You are ONLY ${panelist.name} - never speak as anyone else
2. Keep responses concise (2-3 sentences max for questions)
3. Focus ONLY on your area: ${panelist.focus}
4. ${isIntro
        ? 'Start with a warm, welcoming greeting. Then ask a high-level "icebreaker" question about their background to make them comfortable. Do NOT dive deep yet.'
        : 'Start with a high-level conceptual question in your focus area. detailed follow-ups ONLY if they answer well. Start slow, then go deep.'}
5. Be conversational and natural - this is a live video call
6. DO NOT repeat questions that were already asked in the conversation
7. Build on the candidate's previous answers when asking follow-ups
8. DYNAMIC HANDOFF: If you feel the candidate's answer is better suited for another panelist, OR if you have asked 2-3 questions and want to pass the floor, end your response with: "[PASS: Name]" replacing Name with the target panelist.
   - Example: "That's a great point about team culture. [PASS: ${otherPanelists[0]?.name || 'Next'}]"
   - Example: "I think Alex would be interested in your backend work. [PASS: Alex]"

${isIntro ? `Start with: "Hi ${candidate.name}, welcome! I'm ${panelist.name}, ${panelist.role}. To start us off, could you tell us a little about yourself and your journey?"` : ''}
    `.trim();
  }, [candidate, panelists]);

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
      // Close existing session gracefully
      if (sessionRef.current) {
        console.log('Closing previous session...');
        try {
          await sessionRef.current.close();
        } catch (e) {
          console.warn('Error closing session:', e);
        }
        sessionRef.current = null;

        // Brief pause for clean handoff
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      const panelist = panelists[panelistIndex];
      const voice = PANELIST_VOICES[panelistIndex % PANELIST_VOICES.length];
      const instruction = generatePanelistInstruction(panelistIndex, isIntro);

      console.log(`Switching to panelist: ${panelist.name} with voice: ${voice}`);

      currentPanelistRef.current = panelistIndex;
      setCurrentPanelistIndex(panelistIndex);
      setActiveSpeaker(panelist.name);

      const session = await aiRef.current.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: instruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log(`${panelist.name} session connected`);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleLiveMessage(message, panelist.name);
          },
          onclose: () => {
            console.log(`${panelist.name} session closed`);
          },
          onerror: (err) => {
            console.error(`${panelist.name} session error:`, err);
          }
        }
      });

      sessionRef.current = session;
      lastSpeakerChangeRef.current = Date.now();

    } catch (error) {
      console.error('Failed to switch panelist:', error);
    } finally {
      isSwitchingSessionRef.current = false;
    }
  }, [panelists, generatePanelistInstruction]);

  // Start Session - initialize with first panelist
  const startSession = async () => {
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;
      if (!apiKey) throw new Error("VITE_GEMINI_API_KEY is not set in environment");

      const ai = new GoogleGenAI({ apiKey });
      aiRef.current = ai;

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;

      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;

      // Start with first panelist using switchToPanelist
      await switchToPanelist(0, true);
      setConnected(true);

      // Start media streaming after session is ready
      await startMediaStreaming();

    } catch (e) {
      console.error("Failed to start session:", e);
    }
  };

  const startMediaStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
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
      setMicPermission(true);
      setCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 1. Audio Streaming
      const inputCtx = inputContextRef.current!;
      const source = inputCtx.createMediaStreamSource(stream);
      // Reduce buffer size to 2048 for lower latency (~128ms)
      const processor = inputCtx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmBlob = createPcmBlob(inputData, 16000);

        // Use current session directly from ref
        if (sessionRef.current) {
          sessionRef.current.sendRealtimeInput({ media: pcmBlob });
        }
      };

      source.connect(processor);
      // Route through silent GainNode - capture mic for Gemini but don't play back (prevents overlap with AI)
      const silentGain = inputCtx.createGain();
      silentGain.gain.value = 0;
      processor.connect(silentGain);
      silentGain.connect(inputCtx.destination);

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
      }, 1000);

    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const processAudioQueue = async () => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx || audioQueueRef.current.length === 0) return;
    if (interruptedRef.current) {
      audioQueueRef.current = [];
      return;
    }
    // Strict sequential playback - never start next until current ends
    if (isPlayingAudioRef.current) return;

    isPlayingAudioRef.current = true;
    const audioData = audioQueueRef.current.shift()!;

    try {
      const audioBuffer = await decodeAudioData(base64ToUint8Array(audioData), audioCtx, 24000);
      if (interruptedRef.current) return;

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      currentSourceRef.current = source;

      // Connect to destination (via gain node if we stored it, filtering out pops)
      // For now connect to destination, but we should use a gain node for smoothing
      source.connect(audioCtx.destination);

      const startTime = Math.max(audioCtx.currentTime, nextStartTimeRef.current);
      source.start(startTime);
      nextStartTimeRef.current = startTime + audioBuffer.duration;

      source.onended = () => {
        currentSourceRef.current = null;
        isPlayingAudioRef.current = false;

        // Check if all audio in queue is done
        if (audioQueueRef.current.length === 0) {
          setIsTalking(false);

          // Increment question count and check for panelist rotation
          questionCountRef.current += 1;

          // Rotate panelists every 2-3 questions for natural conversation
          // Also ensure minimum 5 seconds between switches
          const timeSinceLastSwitch = Date.now() - lastSpeakerChangeRef.current;
          if (questionCountRef.current >= 2 && timeSinceLastSwitch > 5000) {
            questionCountRef.current = 0;
            const nextIndex = (currentPanelistRef.current + 1) % panelists.length;

            // Schedule switch with a brief pause for natural handoff
            setTimeout(() => {
              switchToPanelist(nextIndex, false);
            }, 800);
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
    if (!audioCtx) return;

    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text?.trim();
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
          }
          // Remove the token from display text
          content = content.replace(/\[PASS:\s*[^\]]+\]/gi, '').trim();
        }

        // Update active speaker indicator to the known panelist
        setActiveSpeaker(speaker);

        // Check if this is a continuation of the current speaker
        if (currentLineRef.current?.speaker === speaker) {
          const currentContent = currentLineRef.current.content;

          // Gemini sends cumulative text - check if new text starts with current content
          if (content.startsWith(currentContent) && content.length > currentContent.length) {
            // Cumulative update - replace with full text
            currentLineRef.current.content = content;
          } else if (!currentContent.includes(content) && content.length > 0) {
            // New chunk - append with space
            currentLineRef.current.content = currentContent + (currentContent ? ' ' : '') + content;
          }
          // Otherwise it's a duplicate - ignore
        } else {
          // New speaker - save previous line and start new one
          if (currentLineRef.current) {
            transcriptLinesRef.current.push(
              `${currentLineRef.current.speaker}|||${currentLineRef.current.content}`
            );
          }
          currentLineRef.current = { speaker, content, prefix: '' };
        }

        // Update transcript display
        const newTranscript = [
          ...transcriptLinesRef.current,
          currentLineRef.current ? `${currentLineRef.current.speaker}|||${currentLineRef.current.content}` : ''
        ].filter(Boolean);
        setTranscript(newTranscript);
        // Auto-scroll to bottom
        setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
    }

    if (message.serverContent?.inputTranscription) {
      let text = message.serverContent.inputTranscription.text?.trim();
      if (text) {
        // Clean up noise markers
        text = text.replace(/\s*\[(noise|inaudible)\]\s*/gi, ' ').replace(/\s+/g, ' ').trim();

        if (text) {
          const speaker = 'You';
          const content = text;

          // Check if continuing current speaker
          if (currentLineRef.current?.speaker === speaker) {
            const currentContent = currentLineRef.current.content;

            // Cumulative update check
            if (content.startsWith(currentContent) && content.length > currentContent.length) {
              currentLineRef.current.content = content;
            } else if (!currentContent.includes(content) && content.length > 0) {
              currentLineRef.current.content = currentContent + (currentContent ? ' ' : '') + content;
            }
          } else {
            // New speaker - save previous and start new
            if (currentLineRef.current) {
              // Capture intro if it's the first candidate response and long enough (and haven't captured it yet)
              if (currentLineRef.current.speaker === 'You' && !candidateIntroRef.current && currentLineRef.current.content.length > 20) {
                candidateIntroRef.current = currentLineRef.current.content;
              }

              transcriptLinesRef.current.push(
                `${currentLineRef.current.speaker}|||${currentLineRef.current.content}`
              );
            }
            currentLineRef.current = { speaker, content, prefix: '' };
          }

          // Update transcript
          const newTranscript = [
            ...transcriptLinesRef.current,
            currentLineRef.current ? `${currentLineRef.current.speaker}|||${currentLineRef.current.content}` : ''
          ].filter(Boolean);

          // Only trigger re-render if content length changed by >5 chars or it's a new line
          // This prevents flickering on every single character update
          const prevLen = transcript.join('').length;
          const newLen = newTranscript.join('').length;

          if (newTranscript.length !== transcript.length || Math.abs(newLen - prevLen) > 5) {
            setTranscript(newTranscript);
            // Auto-scroll to bottom
            setTimeout(() => transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
          }
        }
      }
    }

    // Process all audio parts (sequential queue prevents overlap)
    const parts = message.serverContent?.modelTurn?.parts ?? [];
    for (const part of parts) {
      const audioData = part?.inlineData?.data;
      if (audioData) {
        setIsTalking(true);
        audioQueueRef.current.push(audioData);
      }
    }
    if (audioQueueRef.current.length > 0) processAudioQueue();

    if (message.serverContent?.interrupted) {
      interruptedRef.current = true;
      currentSourceRef.current?.stop();
      currentSourceRef.current = null;
      audioQueueRef.current = [];
      nextStartTimeRef.current = audioCtx.currentTime;
      isPlayingAudioRef.current = false;
      setIsTalking(false);
      interruptedRef.current = false;
    }
  };

  const cleanupResources = () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(track => track.stop());
    if (processorRef.current) processorRef.current.disconnect();
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (audioContextRef.current?.state !== 'closed') audioContextRef.current?.close().catch(console.error);
    if (inputContextRef.current?.state !== 'closed') inputContextRef.current?.close().catch(console.error);
  };

  const stopInterview = () => {
    cleanupResources();
    onFinish(transcript.join('\n'), duration);
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

  useEffect(() => {
    startSession();
    return () => cleanupResources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="h-[calc(100vh-6rem)] w-[calc(100%-3rem)] max-w-[calc(100vw-3rem)] mx-auto flex gap-6 overflow-visible relative py-6"
    >
      {/* Left: 15% - Panelists */}
      <div className="w-[15%] min-w-0 flex flex-col gap-4 shrink-0 h-full">
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

      {/* Center: 55% - Camera feed */}
      <div className="w-[55%] min-w-0 flex flex-col gap-4 shrink-0 h-full">
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
            <div className="glass px-5 py-2.5 rounded-xl flex items-center gap-2 text-gray-200 border border-white/20">
              <div className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-primary animate-pulse' : 'bg-destructive'}`} />
              <span className="text-sm font-medium tracking-wide">
                {connected ? 'LIVE' : 'CONNECTING...'}
              </span>
              <span className="text-muted-foreground/50 px-2 mx-1">|</span>
              <span className="font-mono text-sm">{formatTime(duration)}</span>
            </div>

            <div className="glass px-5 py-2.5 rounded-xl text-gray-200 flex items-center gap-2 border border-white/20">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{activeSpeaker}</span>
            </div>
          </div>



          {/* Floating Controls */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20">
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
      <div className="w-[25%] min-w-[200px] flex flex-col shrink-0 h-full">
        <div className="flex-1 min-h-0 glass rounded-xl border border-white/20 p-5 shadow-lg shadow-black/20 flex flex-col overflow-hidden min-w-0">
          <div className="flex items-center gap-2 mb-4 text-gray-400 px-1">
            <MessageSquare className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Live Transcript</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 panel-style-textarea">
            {transcript.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center text-gray-300 space-y-3 px-4">
                <p className="text-2xl md:text-3xl font-semibold leading-relaxed">
                  Say hello to start the interview
                </p>
                <p className="text-sm text-gray-500">The panel will introduce themselves and ask the first question</p>
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
    </motion.div>
  );
};
