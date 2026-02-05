import React, { useState } from 'react';
import { AppStage, CandidateProfile, FinalReport, Panelist } from './types';
import { ResumeUploader } from './components/ResumeUploader';
import { PanelConfiguration } from './components/PanelConfiguration';
import { LiveInterview } from './components/LiveInterview';
import { Dashboard } from './components/Dashboard';
import { generateFinalReport, generatePanelists } from './services/geminiService';

function App() {
  const [stage, setStage] = useState<AppStage>(AppStage.LANDING);
  const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
  const [panelists, setPanelists] = useState<Panelist[]>([]);
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Handlers
  const handleResumeUploaded = async (profile: CandidateProfile) => {
    setCandidate(profile);
    setIsProcessing(true);
    // Move to prep immediately, but show loading overlay if needed or just handle state
    try {
        const generatedPanelists = await generatePanelists(profile.targetRole || "General", profile.rawResumeText);
        setPanelists(generatedPanelists);
        setStage(AppStage.INTERVIEW_PREP);
    } catch (e) {
        console.error("Error generating panelists", e);
        alert("Failed to generate custom panel. Using defaults.");
        setStage(AppStage.INTERVIEW_PREP);
        // Fallback or empty (handled by logic)
    } finally {
        setIsProcessing(false);
    }
  };

  const handlePanelistUpdate = (index: number, updatedPanelist: Panelist) => {
      const newPanelists = [...panelists];
      newPanelists[index] = updatedPanelist;
      setPanelists(newPanelists);
  };

  const startInterview = () => {
    setStage(AppStage.LIVE_INTERVIEW);
  };

  const handleInterviewFinished = async (transcript: string) => {
    if (!candidate) return;
    setStage(AppStage.EVALUATION);
    setIsProcessing(true);
    
    try {
        const report = await generateFinalReport(candidate, transcript);
        setFinalReport(report);
    } catch (e) {
        console.error("Error generating report", e);
        alert("Failed to generate report. Please try again.");
    } finally {
        setIsProcessing(false);
    }
  };

  const restart = () => {
    setCandidate(null);
    setFinalReport(null);
    setPanelists([]);
    setStage(AppStage.LANDING);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 selection:bg-blue-500 selection:text-white">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center font-bold text-white">AI</div>
                <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400">
                    Multipanel Interview
                </h1>
            </div>
            {stage !== AppStage.LANDING && (
                <div className="text-sm font-mono text-slate-500">
                    Gemini 3 Powered
                </div>
            )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        
        {/* Stage: LANDING */}
        {stage === AppStage.LANDING && (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8">
                <div className="space-y-4 max-w-2xl">
                    <h2 className="text-5xl font-extrabold text-white tracking-tight">
                        Master Your Next Interview with <span className="text-blue-500">AI Agents</span>
                    </h2>
                    <p className="text-xl text-slate-400">
                        Select a target role, upload your resume, and face a panel of 3 distinct personas tailored to your job. 
                        Get real-time interaction and comprehensive feedback.
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mt-12">
                     <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500 transition-colors">
                         <div className="text-4xl mb-4">🎯</div>
                         <h3 className="font-bold text-white mb-2">Role Specific</h3>
                         <p className="text-sm text-slate-400">Define your target job, and Gemini 3 generates specific interviewer personas for it.</p>
                     </div>
                     <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500 transition-colors">
                         <div className="text-4xl mb-4">🎥</div>
                         <h3 className="font-bold text-white mb-2">Live Multi-Modal</h3>
                         <p className="text-sm text-slate-400">Real-time video & audio interaction with ultra-low latency via Gemini Live API.</p>
                     </div>
                     <div className="p-6 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-blue-500 transition-colors">
                         <div className="text-4xl mb-4">📊</div>
                         <h3 className="font-bold text-white mb-2">Deep Evaluation</h3>
                         <p className="text-sm text-slate-400">Gemini 3 Pro reasons over the entire session to provide actionable scores & feedback.</p>
                     </div>
                </div>

                <button 
                    onClick={() => setStage(AppStage.RESUME_UPLOAD)}
                    className="px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-lg rounded-full shadow-[0_0_20px_rgba(37,99,235,0.4)] transition-all hover:scale-105 mt-8"
                >
                    Start Assessment
                </button>
            </div>
        )}

        {/* Stage: RESUME UPLOAD */}
        {stage === AppStage.RESUME_UPLOAD && !isProcessing && (
            <ResumeUploader onUploadComplete={handleResumeUploaded} />
        )}
        
        {/* Loading State during Persona Generation */}
        {stage === AppStage.RESUME_UPLOAD && isProcessing && (
             <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-bold text-white mb-2">Assembling Your Panel</h2>
                <p className="text-slate-400 text-center max-w-md">
                    Gemini 3 is analyzing your resume and generating specialized interviewer personas for the {candidate?.targetRole} role...
                </p>
            </div>
        )}

        {/* Stage: PREP & CONFIGURATION */}
        {stage === AppStage.INTERVIEW_PREP && candidate && (
            <PanelConfiguration 
                panelists={panelists} 
                onPanelistChange={handlePanelistUpdate}
                onConfirm={startInterview}
            />
        )}

        {/* Stage: LIVE INTERVIEW */}
        {stage === AppStage.LIVE_INTERVIEW && candidate && (
            <LiveInterview 
                candidate={candidate} 
                panelists={panelists} 
                onFinish={handleInterviewFinished} 
            />
        )}

        {/* Stage: EVALUATION PROCESSING */}
        {stage === AppStage.EVALUATION && isProcessing && (
            <div className="flex flex-col items-center justify-center min-h-[50vh]">
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6"></div>
                <h2 className="text-2xl font-bold text-white mb-2">Compiling Evaluation</h2>
                <p className="text-slate-400 text-center max-w-md">
                    Gemini 3 Pro is analyzing the transcript, your tone, and technical accuracy to generate a detailed report...
                </p>
                <div className="mt-8 font-mono text-sm text-slate-600">
                    Reasoning over 1M context window...
                </div>
            </div>
        )}

        {/* Stage: DASHBOARD */}
        {stage === AppStage.EVALUATION && !isProcessing && finalReport && (
            <Dashboard report={finalReport} onRestart={restart} />
        )}

      </main>
    </div>
  );
}

export default App;
