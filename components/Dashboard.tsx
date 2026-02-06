import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FinalReport } from '@/types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { CheckCircle, Award, TrendingUp, User, ArrowRight, RotateCcw, Download, FileText, X } from 'lucide-react';
import { downloadReport, SAMPLE_REPORT } from '@/src/utils/reportDownload';

interface Props {
    report: FinalReport;
    onRestart: () => void;
}

export const Dashboard: React.FC<Props> = ({ report, onRestart }) => {
    const [showSampleReport, setShowSampleReport] = useState(false);

    const handleDownloadReport = () => {
        downloadReport(report);
    };

    const chartData = [
        { subject: 'Technical', A: report.technicalScore, fullMark: 100 },
        { subject: 'Communication', A: report.communicationScore, fullMark: 100 },
        { subject: 'Culture Fit', A: report.cultureFitScore, fullMark: 100 },
        { subject: 'Problem Solving', A: (report.technicalScore + report.communicationScore) / 2, fullMark: 100 },
        { subject: 'Confidence', A: report.cultureFitScore, fullMark: 100 },
    ];

    const averageScore = Math.round((report.technicalScore + report.communicationScore + report.cultureFitScore) / 3);

    const getGrade = (score: number) => {
        if (score >= 90) return { label: 'Excellent', color: 'text-primary', bg: 'bg-primary/10' };
        if (score >= 75) return { label: 'Strong', color: 'text-primary', bg: 'bg-primary/10' };
        if (score >= 60) return { label: 'Good', color: 'text-accent', bg: 'bg-accent/10' };
        return { label: 'Developing', color: 'text-destructive', bg: 'bg-destructive/10' };
    };

    const grade = getGrade(averageScore);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.5 }}
            className="w-[90%] mx-auto max-w-[96rem] pb-24 space-y-10 px-4 md:px-0"
            style={{ paddingTop: '2.5rem' }}
        >
            {/* Header Section */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-12 shadow-lg shadow-black/20">
                <div className="text-center space-y-5">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 text-primary border border-primary/20 text-sm font-medium"
                    >
                        <CheckCircle className="w-4 h-4" />
                        Interview Complete
                    </motion.div>
                    <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-200">
                        Your Interview Results
                    </h1>
                    <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
                        A comprehensive breakdown of your performance across technical and behavioral dimensions.
                    </p>
                </div>
            </section>

            {/* Top Stats Grid */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-10 shadow-lg shadow-black/20">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

                {/* Overall Score Card */}
                <div className="glass rounded-xl border border-white/20 p-8 flex flex-col items-center justify-center relative overflow-hidden shadow-lg shadow-black/20 group hover:border-primary/40 transition-colors">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Award className="w-24 h-24" />
                    </div>
                    <h3 className="text-gray-400 font-medium mb-4 uppercase tracking-wider text-xs">Overall Score</h3>
                    <div className="flex items-baseline gap-1">
                        <span className={`text-7xl font-mono font-bold ${grade.color}`}>
                            {averageScore}
                        </span>
                        <span className="text-gray-400 font-mono text-xl">/100</span>
                    </div>
                    <div className={`mt-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${grade.bg} ${grade.color}`}>
                        {grade.label} Performance
                    </div>
                </div>

                {/* Radar Chart */}
                <div className="glass rounded-xl border border-white/20 p-6 col-span-2 shadow-lg shadow-black/20 relative">
                    <h3 className="text-gray-200 font-semibold mb-4 px-2">Performance Breakdown</h3>
                    <div className="h-[250px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
                                <PolarGrid stroke="rgba(255,255,255,0.15)" />
                                <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(148, 163, 184, 0.9)', fontSize: 12 }} />
                                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                <Radar
                                    name="Candidate"
                                    dataKey="A"
                                    stroke="hsl(var(--primary))"
                                    strokeWidth={3}
                                    fill="hsl(var(--primary))"
                                    fillOpacity={0.2}
                                />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--popover))',
                                        borderColor: 'hsl(var(--border))',
                                        color: 'hsl(var(--popover-foreground))',
                                        borderRadius: '8px',
                                        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                    }}
                                    itemStyle={{ color: 'hsl(var(--primary))' }}
                                />
                            </RadarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
                </div>
            </section>

            {/* Metrics Grid */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-10 shadow-lg shadow-black/20">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                        <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Detailed Feedback
                        </h3>
                    <div className="prose prose-invert prose-sm max-w-none text-gray-400">
                        <p className="whitespace-pre-line leading-relaxed">
                            {report.detailedFeedback}
                        </p>
                    </div>
                </div>

                    <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                        <h3 className="text-lg font-semibold text-gray-200 mb-6 flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center">
                                <ArrowRight className="w-3 h-3 text-primary -rotate-45" />
                            </div>
                            Suggested Improvements
                        </h3>
                    <ul className="space-y-4">
                        {report.improvements.map((imp, idx) => (
                            <motion.li
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 * idx }}
                                key={idx}
                                className="flex items-start gap-4 p-3 rounded-xl bg-white/[0.04] border border-white/10 hover:bg-white/[0.06] transition-colors"
                            >
                                <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-xs font-mono text-primary">{idx + 1}</span>
                                <span className="text-sm text-gray-200 leading-relaxed">{imp}</span>
                            </motion.li>
                        ))}
                    </ul>
                    </div>
                </div>
            </section>

            {/* Panelist Feedback */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-10 shadow-lg shadow-black/20">
                <h2 className="text-2xl font-semibold text-gray-200 mb-8">Panelist Remarks</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {report.panelistComments.map((pc, idx) => (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.3 + (idx * 0.1) }}
                            key={idx}
                            className="glass p-6 rounded-xl border border-white/20 hover:border-primary/40 transition-all shadow-lg shadow-black/20"
                        >
                            <div className="flex items-center gap-4 mb-4">
                                <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-semibold text-lg shadow-sm">
                                    {pc.name[0]}
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-200">{pc.name}</h4>
                                    <p className="text-xs text-gray-400 uppercase tracking-wider">Interviewer</p>
                                </div>
                            </div>
                            <div className="relative">
                                <span className="absolute -top-2 -left-1 text-4xl text-primary/20 select-none">"</span>
                                <p className="text-sm text-gray-400 italic leading-relaxed pl-4 relative z-10">
                                    {pc.comment}
                                </p>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </section>

            {/* Actions */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-12 shadow-lg shadow-black/20">
                <div className="flex flex-col sm:flex-row items-center justify-center gap-5 flex-wrap">
                <button
                    onClick={onRestart}
                    className="px-10 py-4 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20 flex items-center gap-2"
                >
                    <RotateCcw className="w-5 h-5" />
                    Start New Session
                </button>
                <button
                    onClick={handleDownloadReport}
                    className="px-10 py-4 bg-transparent border border-white/20 text-gray-200 font-medium rounded-xl hover:bg-white/[0.06] hover:border-white/30 transition-all flex items-center gap-2"
                >
                    <Download className="w-5 h-5" />
                    Download Report
                </button>
                <button
                    onClick={() => setShowSampleReport(true)}
                    className="px-10 py-4 bg-transparent border border-white/20 text-gray-200 font-medium rounded-xl hover:bg-white/[0.06] hover:border-white/30 transition-all flex items-center gap-2"
                >
                    <FileText className="w-5 h-5" />
                    Show Sample Report
                </button>
                </div>
            </section>

            {/* Sample Report Modal */}
            <AnimatePresence>
                {showSampleReport && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                        onClick={() => setShowSampleReport(false)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            onClick={(e) => e.stopPropagation()}
                            className="glass rounded-2xl border border-white/20 shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                        >
                            <div className="flex items-center justify-between p-6 border-b border-white/20">
                                <h2 className="text-xl font-semibold text-gray-200 flex items-center gap-2">
                                    <FileText className="w-5 h-5 text-primary" />
                                    Sample Report
                                </h2>
                                <button
                                    onClick={() => setShowSampleReport(false)}
                                    className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-gray-200 transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                <div className="text-center">
                                    <div className="inline-flex items-baseline gap-1">
                                        <span className="text-5xl font-mono font-bold text-primary">82</span>
                                        <span className="text-gray-400 font-mono">/100</span>
                                    </div>
                                    <p className="text-gray-400 text-sm mt-2">Sample scores for demonstration</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Detailed Feedback</h3>
                                    <p className="text-sm text-gray-400 whitespace-pre-line">{SAMPLE_REPORT.detailedFeedback}</p>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Improvements</h3>
                                    <ul className="space-y-2">
                                        {SAMPLE_REPORT.improvements.map((imp, idx) => (
                                            <li key={idx} className="text-sm text-gray-400 flex gap-2">
                                                <span className="text-primary font-mono">{idx + 1}.</span>
                                                {imp}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-300 mb-2">Panelist Remarks</h3>
                                    <div className="space-y-3">
                                        {SAMPLE_REPORT.panelistComments.map((pc, idx) => (
                                            <div key={idx} className="p-4 rounded-xl bg-white/[0.04] border border-white/10">
                                                <p className="font-medium text-gray-200 text-sm">{pc.name}</p>
                                                <p className="text-sm text-gray-400 italic mt-1">"{pc.comment}"</p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            <div className="p-6 border-t border-white/20 flex justify-end gap-3">
                                <button
                                    onClick={() => downloadReport(SAMPLE_REPORT, 'sample-report')}
                                    className="px-6 py-2.5 bg-primary text-primary-foreground font-medium rounded-xl hover:bg-primary/90 transition-all flex items-center gap-2"
                                >
                                    <Download className="w-4 h-4" />
                                    Download Sample Report
                                </button>
                                <button
                                    onClick={() => setShowSampleReport(false)}
                                    className="px-6 py-2.5 bg-transparent border border-white/20 text-gray-200 font-medium rounded-xl hover:bg-white/[0.06] transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </motion.div>
    );
};
