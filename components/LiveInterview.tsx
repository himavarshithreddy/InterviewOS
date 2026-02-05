import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { base64ToUint8Array, createPcmBlob, decodeAudioData } from '../utils/audioUtils';
import { CandidateProfile, Panelist } from '../types';

interface Props {
  candidate: CandidateProfile;
  panelists: Panelist[];
  onFinish: (transcriptSummary: string) => void;
}

export const LiveInterview: React.FC<Props> = ({ candidate, panelists, onFinish }) => {
  const [connected, setConnected] = useState(false);
  const [isTalking, setIsTalking] = useState(false);
  const [activeSpeaker, setActiveSpeaker] = useState<string>("System");
  const [transcript, setTranscript] = useState<string[]>([]);
  const [micPermission, setMicPermission] = useState(false);
  const [cameraPermission, setCameraPermission] = useState(false);
  
  // Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoIntervalRef = useRef<number | null>(null);
  const sessionRef = useRef<any>(null); // To store session object

  // Initial prompt construction
  const systemInstruction = `
    You are a panel of three interviewers conducting a job interview for the role of: ${candidate.targetRole || 'Candidate'}.
    The candidate's name is ${candidate.name}.
    
    The panel consists of:
    1. ${panelists[0].name} (${panelists[0].role}): Focuses on ${panelists[0].focus}. ${panelists[0].description}.
    2. ${panelists[1].name} (${panelists[1].role}): Focuses on ${panelists[1].focus}. ${panelists[1].description}.
    3. ${panelists[2].name} (${panelists[2].role}): Focuses on ${panelists[2].focus}. ${panelists[2].description}.

    Candidate Context:
    Skills: ${candidate.skills.join(', ')}
    Experience: ${candidate.experience.slice(0, 3).join('; ')}...

    Rules:
    - You must act as ONE of these personas at a time.
    - Start the conversation by having ONE panelist introduce the panel and ask the first question relevant to the target role (${candidate.targetRole}).
    - Be concise. This is a live video interview.
    - Visually observe the candidate (via the video stream I send you). Comment on their demeanor if relevant (e.g., "You seem confident").
    - IMPORTANT: Prefix every response with the name of the speaker, like "[${panelists[0].name}]: Hello...".
    - Pass the conversation between panelists naturally.
    - If the candidate struggles, offer a hint.
    - Keep questions relevant to a ${candidate.targetRole} position.
  `;

  // Start Session
  const startSession = async () => {
    try {
      const apiKey = process.env.API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const ai = new GoogleGenAI({ apiKey });
      
      // Setup Audio Contexts
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      inputContextRef.current = inputCtx;

      // Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          systemInstruction: systemInstruction,
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {}, // Request transcription of user input
          outputAudioTranscription: {}, // Request transcription of model output
          speechConfig: {
             voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } 
          }
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            console.log("Gemini Live Session Connected");
            startMediaStreaming(sessionPromise);
          },
          onmessage: async (message: LiveServerMessage) => {
            handleLiveMessage(message);
          },
          onclose: () => {
            console.log("Session closed");
            setConnected(false);
          },
          onerror: (err) => {
            console.error("Session error", err);
          }
        }
      });
      
    } catch (e) {
      console.error("Failed to start session:", e);
    }
  };

  const startMediaStreaming = async (sessionPromise: Promise<any>) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      streamRef.current = stream;
      setMicPermission(true);
      setCameraPermission(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      // 1. Audio Streaming
      const inputCtx = inputContextRef.current!;
      const source = inputCtx.createMediaStreamSource(stream);
      const processor = inputCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        // Create PCM blob
        const pcmBlob = createPcmBlob(inputData, 16000);
        
        sessionPromise.then(session => {
            sessionRef.current = session; // store for cleanup/manual sending
            session.sendRealtimeInput({ media: pcmBlob });
        });
      };

      source.connect(processor);
      processor.connect(inputCtx.destination);

      // 2. Video Streaming (Frames)
      // Send a frame every 1 second to save bandwidth but allow "visual" context
      videoIntervalRef.current = window.setInterval(() => {
        if (!canvasRef.current || !videoRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = videoRef.current.videoWidth / 4; // Downscale for performance
        canvasRef.current.height = videoRef.current.videoHeight / 4;
        
        ctx.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
        
        const base64 = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
        
        sessionPromise.then(session => {
             session.sendRealtimeInput({ 
                 media: { 
                     mimeType: 'image/jpeg', 
                     data: base64 
                 } 
             });
        });

      }, 1000);

    } catch (err) {
      console.error("Error accessing media devices:", err);
    }
  };

  const handleLiveMessage = async (message: LiveServerMessage) => {
    const audioCtx = audioContextRef.current;
    if (!audioCtx) return;

    // Handle Text Transcription (Context & History)
    if (message.serverContent?.outputTranscription) {
      const text = message.serverContent.outputTranscription.text;
      if (text) {
          // Attempt to parse speaker from text prefix [Name]:
          const match = text.match(/\[(.*?)]:?/);
          if (match && match[1]) {
             setActiveSpeaker(match[1]);
          }
          setTranscript(prev => [...prev, `AI: ${text}`]);
      }
    }
    
    if (message.serverContent?.inputTranscription) {
         const text = message.serverContent.inputTranscription.text;
         if(text) setTranscript(prev => [...prev, `You: ${text}`]);
    }

    // Handle Audio Output
    const audioData = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
    if (audioData) {
        setIsTalking(true);
      
        // Simple timing logic for gapless playback
        const currentTime = audioCtx.currentTime;
        if (nextStartTimeRef.current < currentTime) {
            nextStartTimeRef.current = currentTime;
        }

        const audioBuffer = await decodeAudioData(
            base64ToUint8Array(audioData),
            audioCtx,
            24000
        );

        const source = audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(audioCtx.destination);
        source.start(nextStartTimeRef.current);
        
        nextStartTimeRef.current += audioBuffer.duration;
        
        source.onended = () => {
             // Heuristic: if gap is large, we stopped talking
             if (audioCtx.currentTime >= nextStartTimeRef.current - 0.1) {
                 setIsTalking(false);
             }
        };
    }
    
    // Handle Interruptions
    if (message.serverContent?.interrupted) {
        setIsTalking(false);
        nextStartTimeRef.current = audioCtx.currentTime;
        // In a real app, cancel currently playing nodes
    }
  };

  const stopInterview = () => {
    // Cleanup
    if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (processorRef.current) {
        processorRef.current.disconnect();
    }
    if (videoIntervalRef.current) {
        clearInterval(videoIntervalRef.current);
    }
    if (audioContextRef.current) {
        audioContextRef.current.close();
    }
    if (inputContextRef.current) {
        inputContextRef.current.close();
    }
    
    // In real Live API, there isn't a strict 'close' method on the session object exposed in the hook
    // but the WebSocket closes when the component unmounts or we can force it.
    // Here we just trigger the finish callback.
    onFinish(transcript.join('\n'));
  };

  // Auto-start on mount
  useEffect(() => {
    startSession();
    return () => {
        stopInterview();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col h-full max-w-6xl mx-auto p-4 gap-6">
      
      {/* Header / Status */}
      <div className="flex justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700">
        <div className="flex items-center gap-3">
             <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
             <span className="font-semibold text-white">{connected ? 'Live Session Active' : 'Connecting to Gemini Live...'}</span>
             {candidate.targetRole && (
                 <span className="ml-4 px-3 py-1 bg-slate-700 rounded-full text-xs text-slate-300 border border-slate-600">
                     Target Role: {candidate.targetRole}
                 </span>
             )}
        </div>
        <button 
            onClick={stopInterview}
            className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors"
        >
            End Interview
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-grow">
        
        {/* Panelists Area (2/3 width) */}
        <div className="md:col-span-2 flex flex-col gap-4">
           {/* Active Speaker Visualizer */}
           <div className="bg-slate-900 rounded-xl p-6 border border-slate-700 flex flex-col items-center justify-center min-h-[300px] relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900 z-10"></div>
                
                {/* Simulated Audio Visualizer Bars */}
                {isTalking && (
                     <div className="absolute bottom-0 flex items-end gap-1 h-32 opacity-50 z-0">
                         {[...Array(20)].map((_, i) => (
                             <div key={i} 
                                  className={`w-4 bg-${panelists.find(p => p.name === activeSpeaker)?.avatarColor || 'blue'}-500 rounded-t-sm animate-bounce`} 
                                  style={{ height: `${Math.random() * 100}%`, animationDuration: `${0.2 + Math.random() * 0.3}s` }}
                             ></div>
                         ))}
                     </div>
                )}

                <div className="z-20 text-center">
                    <h3 className="text-xl text-slate-400 mb-2">Current Speaker</h3>
                    <div className="text-4xl font-bold text-white tracking-tight">
                        {activeSpeaker}
                    </div>
                    {isTalking && <span className="text-sm text-green-400 mt-2 block font-mono">Speaking...</span>}
                </div>
           </div>

           {/* Panelist Cards */}
           <div className="grid grid-cols-3 gap-4">
               {panelists.map((p) => (
                   <div key={p.id} className={`p-4 rounded-lg border transition-all duration-300 ${activeSpeaker.includes(p.name) ? `bg-slate-800 border-${p.avatarColor}-500 shadow-[0_0_15px_rgba(59,130,246,0.3)] transform scale-105` : 'bg-slate-800/50 border-slate-700 opacity-70'}`}>
                       <div className={`w-10 h-10 rounded-full bg-${p.avatarColor}-600 mb-3 flex items-center justify-center font-bold text-lg`}>
                           {p.name[0]}
                       </div>
                       <h4 className="font-bold text-white">{p.name}</h4>
                       <p className="text-xs text-slate-400 uppercase tracking-wider">{p.role}</p>
                   </div>
               ))}
           </div>
        </div>

        {/* User Self-View & Transcript */}
        <div className="flex flex-col gap-4">
             {/* Camera View */}
             <div className="relative rounded-xl overflow-hidden border border-slate-700 bg-black aspect-video shadow-lg">
                 <video ref={videoRef} autoPlay muted playsInline className="w-full h-full object-cover transform scale-x-[-1]" />
                 <canvas ref={canvasRef} className="hidden" />
                 <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs font-mono text-white flex items-center gap-2">
                     <span className={`w-2 h-2 rounded-full ${micPermission ? 'bg-green-500' : 'bg-red-500'}`}></span>
                     Mic
                     <span className={`w-2 h-2 rounded-full ${cameraPermission ? 'bg-green-500' : 'bg-red-500'} ml-2`}></span>
                     Cam
                 </div>
             </div>

             {/* Live Transcript Log */}
             <div className="flex-grow bg-slate-800 rounded-xl border border-slate-700 p-4 overflow-hidden flex flex-col">
                 <h3 className="text-sm font-bold text-slate-400 mb-2 uppercase">Live Transcript</h3>
                 <div className="flex-grow overflow-y-auto space-y-2 text-sm pr-2 scrollbar-thin">
                     {transcript.length === 0 && <p className="text-slate-600 italic">Conversation starting...</p>}
                     {transcript.map((line, idx) => (
                         <div key={idx} className={`p-2 rounded ${line.startsWith('You:') ? 'bg-slate-700 ml-4' : 'bg-slate-700/50 mr-4'}`}>
                             {line}
                         </div>
                     ))}
                 </div>
             </div>
        </div>

      </div>
    </div>
  );
};
