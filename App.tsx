import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { CandidateProfile, FinalReport, Panelist } from './types';
import { ResumeUploader } from './components/ResumeUploader';
import { PanelConfiguration } from './components/PanelConfiguration';
import { LiveInterview } from './components/LiveInterview';
import { Dashboard } from './components/Dashboard';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { apiClient } from './src/services/apiClient';
import { sessionStorage } from './src/utils/sessionStorage';
import { SAMPLE_REPORT, openReportInNewTab } from './src/utils/reportDownload';
import { MIN_INTERVIEW_DURATION_SECONDS } from './src/constants';
import {
    Sparkles,
    Brain,
    Video,
    FileText,
    ChevronRight,
    Zap,
    Target,
    Users,
    BarChart3,
    Shield,
    Upload,
    Play,
    RotateCcw
} from 'lucide-react';

function App() {
    const [candidate, setCandidate] = useState<CandidateProfile | null>(null);
    const [panelists, setPanelists] = useState<Panelist[]>([]);
    const [finalReport, setFinalReport] = useState<FinalReport | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);
    const [interviewTooShort, setInterviewTooShort] = useState(false);
    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [cursorActive, setCursorActive] = useState(false);

    const navigate = useNavigate();
    const location = useLocation();

    const handleGetStarted = () => {
        navigate('/upload');
    };

    // Clear session when visiting landing page
    useEffect(() => {
        if (location.pathname === '/') {
            setCandidate(null);
            setPanelists([]);
            setFinalReport(null);
            setInterviewTooShort(false);
            sessionStorage.clearAll();
            hasRestoredRef.current = false; // Allow restoration if they navigate away and come back (though data is cleared so it won't matter)
        }
    }, [location.pathname]);

    // Restore session only once on initial mount (e.g. after page refresh)
    const hasRestoredRef = useRef(false);
    useEffect(() => {
        if (hasRestoredRef.current || isProcessing) return;
        // Don't restore/redirect if we are viewing sample report OR if we are on landing page
        if (location.pathname === '/sample-report' || location.pathname === '/') return;

        if (candidate && panelists.length > 0) return; // Already have state, skip (e.g. just completed flow)
        const savedCandidate = sessionStorage.getCandidate();
        const savedPanelists = sessionStorage.getPanelists();
        if (savedCandidate && savedPanelists && savedPanelists.length > 0) {
            hasRestoredRef.current = true;
            setCandidate(savedCandidate);
            setPanelists(savedPanelists);
            // Defer navigate so state updates are applied before /panel route renders
            setTimeout(() => navigate('/panel', { replace: true }), 0);
        }
    }, [navigate, isProcessing, candidate, panelists.length, location.pathname]);

    // Handlers
    const handleResumeUploaded = async (profile: CandidateProfile) => {
        setCandidate(profile);
        sessionStorage.saveCandidate(profile);
        setIsProcessing(true);

        try {
            const generatedPanelists = await apiClient.generatePanelists(
                profile.targetRole || 'General',
                profile.rawResumeText,
                profile.difficulty || 'Medium'
            );
            setPanelists(generatedPanelists);
            sessionStorage.savePanelists(generatedPanelists);
            navigate('/panel');
        } catch (error: any) {
            console.error('Error generating panelists:', error);
            // Don't block user, let them retry
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePanelistUpdate = (index: number, updatedPanelist: Panelist) => {
        const newPanelists = [...panelists];
        newPanelists[index] = updatedPanelist;
        setPanelists(newPanelists);
        sessionStorage.savePanelists(newPanelists);
    };

    const startInterview = () => {
        navigate('/interview');
    };

    const handleInterviewFinished = async (transcript: string, durationSeconds: number, bodyLanguageHistory: any[], emotionHistory: any[]) => {
        if (!candidate) return;
        navigate('/results');

        if (durationSeconds < MIN_INTERVIEW_DURATION_SECONDS) {
            setInterviewTooShort(true);
            setFinalReport(null);
            setIsProcessing(false);
            return;
        }

        setIsProcessing(true);
        setInterviewTooShort(false);

        try {
            const report = await apiClient.generateReport(candidate, transcript, bodyLanguageHistory, emotionHistory);
            setFinalReport(report);
        } catch (error: any) {
            console.error('Error generating report:', error);
        } finally {
            setIsProcessing(false);
        }
    };

    const restart = () => {
        setCandidate(null);
        setFinalReport(null);
        setPanelists([]);
        setInterviewTooShort(false);
        sessionStorage.clearAll();
    };

    const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
        setCursorPos({ x: event.clientX, y: event.clientY });
        if (!cursorActive) {
            setCursorActive(true);
        }
    };

    const scrollToSection = (id: string) => {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handleNavSectionClick = (sectionId: string) => {
        if (location.pathname !== '/') {
            navigate('/');
            setTimeout(() => scrollToSection(sectionId), 300);
        } else {
            scrollToSection(sectionId);
        }
    };

    return (
        <ErrorBoundary>
            <div
                className="relative min-h-screen text-foreground font-sans selection:bg-primary/20 selection:text-primary"
                onMouseMove={handleMouseMove}
            >
                {/* Navbar */}
                <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/40">
                    <div className="container mx-auto px-6 h-16 flex items-center justify-between">
                        <div
                            className="flex items-center gap-2 cursor-pointer"
                            onClick={() => navigate('/')}
                        >
                            <img src="/logo.svg" alt="InterviewOS" className="h-8 w-8 flex-shrink-0" />
                            <span className="font-semibold tracking-tight text-lg">
                                InterviewOS
                            </span>
                        </div>

                        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
                            {location.pathname === '/' ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => handleNavSectionClick('features')}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Features
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleNavSectionClick('how-it-works')}
                                        className="text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        How it Works
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleGetStarted}
                                        className="inline-flex items-center justify-center gap-2 whitespace-nowrap bg-foreground text-background font-semibold shadow-lg hover:bg-foreground/90 hover:shadow-xl active:scale-[0.98] transition-all duration-200 h-9 rounded-md px-4 text-xs"
                                    >
                                        Get Started
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => navigate('/')}
                                    className="text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <ChevronRight className="w-4 h-4 rotate-180" />
                                    Back
                                </button>
                            )}
                        </nav>
                    </div>
                </header>

                <main className="relative z-10 pt-16 overflow-hidden px-6">
                    {/* 3D tunnel background - landing page only */}
                    {location.pathname === '/' && (
                        <div className="scene">
                            <div className="wrap">
                                <div className="wall wall-right" />
                                <div className="wall wall-left" />
                                <div className="wall wall-top" />
                                <div className="wall wall-bottom" />
                                <div className="wall wall-back" />
                            </div>
                            <div className="wrap">
                                <div className="wall wall-right" />
                                <div className="wall wall-left" />
                                <div className="wall wall-top" />
                                <div className="wall wall-bottom" />
                                <div className="wall wall-back" />
                            </div>
                        </div>
                    )}
                    <AnimatePresence mode="wait">
                        <Routes location={location} key={location.pathname}>
                            <Route
                                path="/"
                                element={<LandingPage onGetStarted={handleGetStarted} />}
                            />
                            <Route
                                path="/upload"
                                element={
                                    isProcessing ? (
                                        <GeneratingPanelScreen candidate={candidate} />
                                    ) : (
                                        <ResumeUploader onUploadComplete={handleResumeUploaded} />
                                    )
                                }
                            />
                            <Route
                                path="/panel"
                                element={
                                    candidate && panelists.length > 0 ? (
                                        <PanelConfiguration
                                            panelists={panelists}
                                            onPanelistChange={handlePanelistUpdate}
                                            onConfirm={startInterview}
                                        />
                                    ) : (
                                        <Navigate to="/upload" replace />
                                    )
                                }
                            />
                            <Route
                                path="/interview"
                                element={
                                    candidate && panelists.length > 0 ? (
                                        <LiveInterview
                                            candidate={candidate}
                                            panelists={panelists}
                                            onFinish={handleInterviewFinished}
                                        />
                                    ) : (
                                        <Navigate to="/upload" replace />
                                    )
                                }
                            />
                            <Route
                                path="/results"
                                element={
                                    isProcessing ? (
                                        <EvaluationLoadingScreen />
                                    ) : interviewTooShort ? (
                                        <ShortInterviewScreen onRestart={restart} />
                                    ) : finalReport ? (
                                        <Dashboard report={finalReport} onRestart={restart} />
                                    ) : (
                                        <Navigate to="/" replace />
                                    )
                                }
                            />
                            <Route
                                path="/sample-report"
                                element={<Dashboard report={SAMPLE_REPORT} onRestart={() => window.close()} />}
                            />
                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Routes>
                    </AnimatePresence>
                </main>

                {/* Custom cursor halo for landing page */}
                {location.pathname === '/' && cursorActive && (
                    <motion.div
                        className="pointer-events-none fixed z-40 hidden md:block"
                        style={{ left: cursorPos.x, top: cursorPos.y }}
                        initial={{ scale: 0.6, opacity: 0.3 }}
                        animate={{ scale: 1, opacity: 0.6 }}
                        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    >
                        <div className="w-11 h-11 rounded-full border border-primary/60 bg-primary/35 shadow-[0_0_24px_rgba(56,189,248,0.4)] backdrop-blur-md -translate-x-1/2 -translate-y-1/2" />
                    </motion.div>
                )}
            </div>
        </ErrorBoundary>
    );
}

interface LandingPageProps {
    onGetStarted: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onGetStarted }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col gap-16 pt-16"
        >
            {/* Hero Section */}
            <section className="relative w-[90%] mx-auto h-[calc(100vh-4rem-4rem-4rem)] flex flex-col justify-center rounded-3xl border border-white/80 glass hero-shell px-6">
                <div className="relative mx-auto">
                    <div className="max-w-4xl mx-auto text-center">
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 }}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-muted-foreground text-xs sm:text-sm font-medium mb-6"
                        >
                            <Zap className="w-4 h-4 text-primary" />
                            <span>Powered by Gemini 3</span>
                        </motion.div>

                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground mb-6 leading-[1.1]">
                            Interview Like It's 2099 - With{' '}
                            <span className="text-gradient">
                                Superintelligent
                            </span>{' '}
                            AI
                        </h2>

                        <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 leading-relaxed">
                            Train with AI panelists that read your resume, watch your every word, and hit back with real-time feedback to level you up.
                        </p>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                            <button
                                type="button"
                                onClick={onGetStarted}
                                className="inline-flex items-center justify-center gap-2 bg-foreground text-background shadow-lg hover:bg-foreground/90 hover:shadow-xl active:scale-[0.98] transition-all duration-200 h-14 rounded-xl px-8 text-lg font-semibold group"
                            >
                                <Upload className="w-5 h-5 mr-1" />
                                Upload Resume
                                <ChevronRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section id="features" className="h-[calc(100vh-4rem-4rem)] flex flex-col justify-center glass rounded-3xl border border-white/80 w-[90%] mx-auto px-6">
                <div className="mx-auto max-w-5xl">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary/80 mb-4">
                            Features
                        </p>
                        <h3 className="text-3xl md:text-[2.4rem] font-bold text-foreground">
                            What you get with InterviewOS
                        </h3>
                    </div>

                    <div className="grid gap-7 md:gap-9 md:grid-cols-2">
                        {[
                            {
                                icon: <Users className="w-6 h-6 text-primary" />,
                                title: 'Multi-panel AI interview',
                                desc: 'Practice with three coordinated AI interviewers you can tune to your role.'
                            },
                            {
                                icon: <Zap className="w-6 h-6 text-primary" />,
                                title: 'Adaptive question engine',
                                desc: 'InterviewOrchestrator™ adjusts difficulty and follow‑ups based on each answer.'
                            },
                            {
                                icon: <BarChart3 className="w-6 h-6 text-primary" />,
                                title: 'Emotion & delivery insight',
                                desc: 'Live scores for confidence, nervousness, enthusiasm, pace, and clarity.'
                            },
                            {
                                icon: <Video className="w-6 h-6 text-primary" />,
                                title: 'Live sessions + deep reports',
                                desc: 'Real-time Gemini sessions plus rich dashboards and Thought Signatures™.'
                            }
                        ].map((feature, idx) => (
                            <motion.div
                                key={feature.title}
                                initial={{ opacity: 0, y: 18 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.3 }}
                                transition={{ duration: 0.3, delay: idx * 0.05 }}
                                whileHover={{ y: -4, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="p-7 rounded-2xl border border-border bg-card/90 hover:border-primary/40 hover:shadow-lg transition-all duration-200 flex gap-5"
                            >
                                <div className="flex-shrink-0">
                                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                                        {feature.icon}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <h4 className="font-semibold text-foreground text-base md:text-lg">
                                        {feature.title}
                                    </h4>
                                    <p className="text-sm md:text-base text-muted-foreground leading-relaxed">
                                        {feature.desc}
                                    </p>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section id="how-it-works" className="h-[calc(100vh-4rem-4rem)] flex flex-col justify-center rounded-3xl border border-white/80 glass w-[90%] mx-auto px-6">
                <div className="mx-auto">
                    <div className="text-center max-w-3xl mx-auto mb-12">
                        <h3 className="text-3xl md:text-4xl font-bold text-foreground mb-3">
                            How It Works
                        </h3>
                        <p className="text-muted-foreground text-lg">
                            Three simple steps to interview excellence
                        </p>
                    </div>

                    <div className="max-w-4xl mx-auto space-y-10">
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{ duration: 0.35 }}
                            className="flex gap-6 justify-center items-start text-left"
                        >
                            <div className="text-4xl font-mono font-bold text-primary/30">
                                01
                            </div>
                            <div>
                                <h4 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
                                    Upload Your Resume
                                </h4>
                                <p className="text-muted-foreground text-sm md:text-base">
                                    Drop your PDF and our AI instantly parses your experience,
                                    skills, and background.
                                </p>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{ duration: 0.35, delay: 0.1 }}
                            className="flex gap-6 justify-center items-start text-left"
                        >
                            <div className="text-4xl font-mono font-bold text-primary/30">
                                02
                            </div>
                            <div>
                                <h4 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
                                    Face the Panel
                                </h4>
                                <p className="text-muted-foreground text-sm md:text-base">
                                    Engage with AI panelists in a realistic video interview setting
                                    with real-time transcription.
                                </p>
                            </div>
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            whileInView={{ opacity: 1, x: 0 }}
                            viewport={{ once: true, amount: 0.4 }}
                            transition={{ duration: 0.35, delay: 0.2 }}
                            className="flex gap-6 justify-center items-start text-left"
                        >
                            <div className="text-4xl font-mono font-bold text-primary/30">
                                03
                            </div>
                            <div>
                                <h4 className="text-xl md:text-2xl font-semibold text-foreground mb-2">
                                    Get Your Score
                                </h4>
                                <p className="text-muted-foreground text-sm md:text-base">
                                    Receive detailed feedback on soft skills, technical depth, and
                                    areas for improvement.
                                </p>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </section>

            {/* CTA & Footer */}
            <section className="py-20 lg:py-24 flex flex-col justify-center rounded-3xl glass border border-white/80 shadow-xl w-[90%] mx-auto px-6">
                <div className="mx-auto text-center">
                    <h3 className="text-3xl md:text-4xl font-bold mb-4">
                        Ready to Ace Your Next Interview?
                    </h3>
                    <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
                        Join professionals who have improved their interview skills with InterviewOS.
                    </p>
                    <button
                        type="button"
                        onClick={onGetStarted}
                        className="inline-flex items-center justify-center gap-2 h-14 rounded-xl px-8 text-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 shadow-lg"
                    >
                        Start Your First Interview
                        <ChevronRight className="w-5 h-5 ml-1" />
                    </button>
                </div>
            </section>

            <footer className="pt-4">
                <div className="w-full bg-background border-t border-border/80 px-4 py-4 rounded-b-3xl flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground/90">
                    <div className="flex items-center gap-2">
                        <img src="/logo.svg" alt="InterviewOS" className="h-6 w-6 flex-shrink-0" />
                        <span className="font-semibold tracking-tight text-sm text-foreground">
                            InterviewOS
                        </span>
                    </div>
                    <p>© {new Date().getFullYear()} InterviewOS. Built with Gemini 3.</p>
                </div>
            </footer>
        </motion.div>
    );
};

interface GeneratingPanelScreenProps {
    candidate: CandidateProfile | null;
}

const GeneratingPanelScreen: React.FC<GeneratingPanelScreenProps> = ({ candidate }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center min-h-[calc(100vh-6rem)] py-12 px-6"
        >
            <section className="w-full max-w-xl mx-auto">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10 md:p-14 shadow-2xl shadow-black/20">
                    {/* Subtle grid background */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }} />
                    <div className="relative flex flex-col items-center text-center">
                        {/* Icon with glow */}
                        <div className="relative mb-10">
                            <div className="absolute -inset-4 bg-primary/15 rounded-2xl blur-2xl animate-pulse" />
                            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20">
                                <Users className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 tracking-tight">
                            Assembling Your Panel
                        </h2>
                        <p className="text-gray-400 text-base md:text-lg max-w-sm leading-relaxed">
                            Analyzing your resume and generating specialized interviewer personas for the{' '}
                            <span className="text-primary font-medium">{candidate?.targetRole || 'selected'}</span> role
                            <span className="inline-flex ml-0.5">
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>.</motion.span>
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                            </span>
                        </p>
                        {/* Progress bar */}
                        <div className="mt-8 w-full max-w-xs h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                                className="h-full bg-primary/60 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: ['0%', '70%', '70%'] }}
                                transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.5 }}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </motion.div>
    );
};

interface ShortInterviewScreenProps {
    onRestart: () => void;
}

const ShortInterviewScreen: React.FC<ShortInterviewScreenProps> = ({ onRestart }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center min-h-[calc(100vh-6rem)] py-12 px-6"
        >
            <section className="w-full max-w-xl mx-auto">
                <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10 md:p-14 shadow-2xl shadow-black/20">
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }} />
                    <div className="relative flex flex-col items-center text-center">
                        <div className="relative mb-10">
                            <div className="absolute -inset-4 bg-destructive/15 rounded-2xl blur-2xl" />
                            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-destructive/10 border border-destructive/20">
                                <Video className="w-10 h-10 text-destructive" />
                            </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold text-foreground mb-3 tracking-tight">
                            Interview Too Short
                        </h2>
                        <p className="text-gray-400 text-base md:text-lg max-w-sm leading-relaxed mb-8">
                            Your interview ended before 5 minutes. To receive a full evaluation,
                            please stay on the call for at least 5 minutes next time.
                        </p>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 flex-wrap">
                            <button
                                type="button"
                                onClick={onRestart}
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all shadow-lg flex items-center gap-2"
                            >
                                <RotateCcw className="w-5 h-5" />
                                Start New Session
                            </button>
                            <button
                                type="button"
                                onClick={openReportInNewTab}
                                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-transparent border border-white/20 text-gray-200 font-medium rounded-xl hover:bg-white/[0.06] hover:border-white/30 transition-all flex items-center gap-2"
                            >
                                <FileText className="w-5 h-5" />
                                Open Sample Report
                            </button>
                        </div>
                    </div>
                </div>
            </section>
        </motion.div>
    );
};

const EvaluationLoadingScreen: React.FC = () => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="flex items-center justify-center min-h-[calc(100vh-6rem)] py-12 px-6"
        >
            <section className="w-full max-w-xl mx-auto">
                <div className="relative overflow-hidden rounded-2xl border border-white/20 bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-10 md:p-14 shadow-2xl shadow-black/20">
                    {/* Subtle grid background */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{
                        backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
                                        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
                        backgroundSize: '24px 24px'
                    }} />
                    <div className="relative flex flex-col items-center text-center">
                        <div className="relative mb-10">
                            <div className="absolute -inset-4 bg-primary/15 rounded-2xl blur-2xl animate-pulse" />
                            <div className="relative flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20">
                                <Brain className="w-10 h-10 text-primary" />
                            </div>
                        </div>
                        <h2 className="text-2xl md:text-3xl font-semibold text-gray-200 mb-3 tracking-tight">
                            Compiling Evaluation
                        </h2>
                        <p className="text-gray-400 text-base md:text-lg max-w-sm leading-relaxed">
                            Analyzing transcript, checking technical accuracy, and generating feedback
                            <span className="inline-flex ml-0.5">
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity }}>.</motion.span>
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                                <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                            </span>
                        </p>
                        <div className="mt-8 w-full max-w-xs h-1 rounded-full bg-white/5 overflow-hidden">
                            <motion.div
                                className="h-full bg-primary/60 rounded-full"
                                initial={{ width: '0%' }}
                                animate={{ width: ['0%', '70%', '70%'] }}
                                transition={{ duration: 3, repeat: Infinity, repeatDelay: 0.5 }}
                            />
                        </div>
                    </div>
                </div>
            </section>
        </motion.div>
    );
};

export default App;
