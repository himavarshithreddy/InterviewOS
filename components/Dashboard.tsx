import React from 'react';
import { motion } from 'framer-motion';
import { FinalReport } from '@/types';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from 'recharts';
import { CheckCircle, Award, TrendingUp, ArrowRight, RotateCcw, Download, FileText } from 'lucide-react';
import { downloadReportAsPDF, openReportInNewTab, SAMPLE_REPORT } from '@/src/utils/reportDownload';

interface Props {
    report: FinalReport;
    onRestart: () => void;
}

export const Dashboard: React.FC<Props> = ({ report, onRestart }) => {
    const handleDownloadReport = async () => {
        await downloadReportAsPDF('report-container', 'interview-report');
    };

    const handleShowSampleReport = () => {
        openReportInNewTab();
    };

    // Ensure required arrays exist with defaults
    const safeReport = {
        ...report,
        improvements: report.improvements || [],
        panelistComments: report.panelistComments || [],
    };

    const chartData = [
        { subject: 'Technical', A: safeReport.technicalScore, fullMark: 100 },
        { subject: 'Communication', A: safeReport.communicationScore, fullMark: 100 },
        { subject: 'Culture Fit', A: safeReport.cultureFitScore, fullMark: 100 },
        { subject: 'Problem Solving', A: (safeReport.technicalScore + safeReport.communicationScore) / 2, fullMark: 100 },
        { subject: 'Confidence', A: safeReport.cultureFitScore, fullMark: 100 },
    ];

    const averageScore = Math.round((safeReport.technicalScore + safeReport.communicationScore + safeReport.cultureFitScore) / 3);

    const getGrade = (score: number) => {
        if (score >= 90) return { label: 'Excellent', color: 'text-primary', bg: 'bg-primary/10' };
        if (score >= 75) return { label: 'Strong', color: 'text-primary', bg: 'bg-primary/10' };
        if (score >= 60) return { label: 'Good', color: 'text-accent', bg: 'bg-accent/10' };
        return { label: 'Developing', color: 'text-destructive', bg: 'bg-destructive/10' };
    };

    const grade = getGrade(averageScore);

    return (
        <motion.div
            id="report-container"
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
                                {safeReport.detailedFeedback}
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
                            {safeReport.improvements.map((imp, idx) => (
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

            {/* Sample Data Warning */}
            {safeReport.analysisNote && (
                <section className="glass rounded-2xl border border-amber-500/30 px-8 py-6 shadow-lg shadow-black/20 bg-amber-500/5">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <FileText className="w-4 h-4 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-sm font-semibold text-amber-200 mb-1">Data Notice</h3>
                            <p className="text-sm text-gray-300 leading-relaxed">{safeReport.analysisNote}</p>
                        </div>
                    </div>
                </section>
            )}

            {/* Comprehensive Analysis Sections */}
            {(safeReport.bodyLanguageAnalysis || safeReport.emotionAnalysis || safeReport.speechPatterns) && (
                <section className="glass rounded-2xl border border-white/20 px-8 py-10 shadow-lg shadow-black/20">
                    <h2 className="text-2xl font-semibold text-gray-200 mb-8">Comprehensive Analysis</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                        {/* Body Language Analysis */}
                        {safeReport.bodyLanguageAnalysis && (
                            <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                                <div className="flex items-center justify-between mb-6">
                                    <h3 className="text-lg font-semibold text-gray-200">Body Language</h3>
                                    <div className="flex items-center gap-2">
                                        <span className="text-3xl font-mono font-bold text-primary">{safeReport.bodyLanguageAnalysis.overallScore}</span>
                                        <span className="text-sm text-gray-400">/100</span>
                                        <span className={`ml-2 px-2 py-1 rounded text-xs font-bold ${safeReport.bodyLanguageAnalysis.grade === 'A' ? 'bg-primary/10 text-primary' :
                                                safeReport.bodyLanguageAnalysis.grade === 'B' ? 'bg-primary/10 text-primary' :
                                                    safeReport.bodyLanguageAnalysis.grade === 'C' ? 'bg-accent/10 text-accent' :
                                                        'bg-destructive/10 text-destructive'
                                            }`}>
                                            {safeReport.bodyLanguageAnalysis.grade}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    {/* Posture */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Posture</span>
                                            <span className="text-sm font-mono text-primary">{Math.round(safeReport.bodyLanguageAnalysis.posture.score * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.bodyLanguageAnalysis.posture.score * 100}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-400">{safeReport.bodyLanguageAnalysis.posture.recommendation}</p>
                                    </div>

                                    {/* Eye Contact */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Eye Contact</span>
                                            <span className="text-sm font-mono text-primary">{safeReport.bodyLanguageAnalysis.eyeContact.percentage}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.bodyLanguageAnalysis.eyeContact.percentage}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-400">{safeReport.bodyLanguageAnalysis.eyeContact.recommendation}</p>
                                    </div>

                                    {/* Gestures */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Gestures</span>
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{safeReport.bodyLanguageAnalysis.gestures.frequency}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-2">{safeReport.bodyLanguageAnalysis.gestures.recommendation}</p>
                                    </div>

                                    {/* Facial Expression */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Facial Expression Variety</span>
                                            <span className="text-sm font-mono text-primary">{Math.round(safeReport.bodyLanguageAnalysis.facialExpression.variety * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5 mb-2">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.bodyLanguageAnalysis.facialExpression.variety * 100}%` }}></div>
                                        </div>
                                        <p className="text-xs text-gray-400">{safeReport.bodyLanguageAnalysis.facialExpression.recommendation}</p>
                                    </div>
                                </div>

                                {/* Strengths & Improvements */}
                                {((safeReport.bodyLanguageAnalysis.strengths || []).length > 0 || (safeReport.bodyLanguageAnalysis.improvements || []).length > 0) && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        {(safeReport.bodyLanguageAnalysis.strengths || []).length > 0 && (
                                            <div className="mb-3">
                                                <h4 className="text-xs font-semibold text-gray-300 mb-2">Strengths</h4>
                                                <ul className="space-y-1">
                                                    {(safeReport.bodyLanguageAnalysis.strengths || []).map((strength, idx) => (
                                                        <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                                            <CheckCircle className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                            <span>{strength}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                        {(safeReport.bodyLanguageAnalysis.improvements || []).length > 0 && (
                                            <div>
                                                <h4 className="text-xs font-semibold text-gray-300 mb-2">Areas to Improve</h4>
                                                <ul className="space-y-1">
                                                    {(safeReport.bodyLanguageAnalysis.improvements || []).map((improvement, idx) => (
                                                        <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                                            <ArrowRight className="w-3 h-3 text-accent flex-shrink-0 mt-0.5" />
                                                            <span>{improvement}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Emotion & Sentiment Analysis */}
                        {safeReport.emotionAnalysis && (
                            <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                                <h3 className="text-lg font-semibold text-gray-200 mb-6">Emotion & Sentiment</h3>

                                <div className="space-y-4">
                                    {/* Confidence */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Confidence</span>
                                            <span className="text-sm font-mono text-primary">{Math.round(safeReport.emotionAnalysis.averageConfidence * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.emotionAnalysis.averageConfidence * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Enthusiasm */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Enthusiasm</span>
                                            <span className="text-sm font-mono text-primary">{Math.round(safeReport.emotionAnalysis.averageEnthusiasm * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.emotionAnalysis.averageEnthusiasm * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Nervousness */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Nervousness</span>
                                            <span className="text-sm font-mono text-accent">{Math.round(safeReport.emotionAnalysis.averageNervousness * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-accent h-1.5 rounded-full" style={{ width: `${safeReport.emotionAnalysis.averageNervousness * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Sentiment */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-300">Overall Sentiment</span>
                                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${safeReport.emotionAnalysis.overallSentiment === 'positive' ? 'bg-primary/10 text-primary' :
                                                    safeReport.emotionAnalysis.overallSentiment === 'negative' ? 'bg-destructive/10 text-destructive' :
                                                        'bg-white/10 text-gray-300'
                                                }`}>
                                                {safeReport.emotionAnalysis.overallSentiment}
                                            </span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className={`h-1.5 rounded-full ${safeReport.emotionAnalysis.sentimentScore > 0 ? 'bg-primary' :
                                                    safeReport.emotionAnalysis.sentimentScore < 0 ? 'bg-destructive' :
                                                        'bg-gray-400'
                                                }`} style={{ width: `${Math.abs(safeReport.emotionAnalysis.sentimentScore) * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Voice Characteristics */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-2">Voice Characteristics</h4>
                                        <div className="grid grid-cols-3 gap-2 text-xs">
                                            <div>
                                                <span className="text-gray-400">Pace:</span>
                                                <span className="ml-1 text-gray-200 capitalize">{safeReport.emotionAnalysis.voiceCharacteristics.pace}</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Clarity:</span>
                                                <span className="ml-1 text-gray-200">{Math.round(safeReport.emotionAnalysis.voiceCharacteristics.clarity * 100)}%</span>
                                            </div>
                                            <div>
                                                <span className="text-gray-400">Volume:</span>
                                                <span className="ml-1 text-gray-200 capitalize">{safeReport.emotionAnalysis.voiceCharacteristics.volume}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Recommendations */}
                                {(safeReport.emotionAnalysis.recommendations || []).length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-2">Key Insights</h4>
                                        <ul className="space-y-1">
                                            {(safeReport.emotionAnalysis.recommendations || []).map((rec, idx) => (
                                                <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                                    <CheckCircle className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                    <span>{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Speech Patterns */}
                        {safeReport.speechPatterns && (
                            <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                                <h3 className="text-lg font-semibold text-gray-200 mb-6">Speech Patterns</h3>

                                <div className="space-y-4">
                                    {/* Speaking Pace */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Speaking Pace</span>
                                            <span className="text-sm font-mono text-primary">{safeReport.speechPatterns.averagePace} WPM</span>
                                        </div>
                                        <p className="text-xs text-gray-400 mt-1">Optimal range: 130-160 words per minute</p>
                                    </div>

                                    {/* Clarity */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-1">
                                            <span className="text-sm font-medium text-gray-300">Clarity Score</span>
                                            <span className="text-sm font-mono text-primary">{Math.round(safeReport.speechPatterns.clarityScore * 100)}%</span>
                                        </div>
                                        <div className="w-full bg-white/10 rounded-full h-1.5">
                                            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${safeReport.speechPatterns.clarityScore * 100}%` }}></div>
                                        </div>
                                    </div>

                                    {/* Filler Words */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-sm font-medium text-gray-300">Filler Words</span>
                                            <span className="text-sm font-mono text-accent">{safeReport.speechPatterns.fillerWordCount}</span>
                                        </div>
                                        <div className="flex flex-wrap gap-1">
                                            {(safeReport.speechPatterns.fillerWords || []).map((word, idx) => (
                                                <span key={idx} className="text-xs px-2 py-0.5 rounded bg-white/10 text-gray-400">
                                                    {word}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Pause Analysis */}
                                    <div className="p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-1">Pause Analysis</h4>
                                        <p className="text-xs text-gray-400">{safeReport.speechPatterns.pauseAnalysis}</p>
                                    </div>
                                </div>

                                {/* Recommendations */}
                                {(safeReport.speechPatterns.recommendations || []).length > 0 && (
                                    <div className="mt-4 pt-4 border-t border-white/10">
                                        <h4 className="text-xs font-semibold text-gray-300 mb-2">Recommendations</h4>
                                        <ul className="space-y-1">
                                            {(safeReport.speechPatterns.recommendations || []).map((rec, idx) => (
                                                <li key={idx} className="text-xs text-gray-400 flex items-start gap-2">
                                                    <ArrowRight className="w-3 h-3 text-primary flex-shrink-0 mt-0.5" />
                                                    <span>{rec}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Temporal Trends */}
                        {safeReport.temporalTrends && (() => {
                            const ct = safeReport.temporalTrends.confidenceTrend || [];
                            const nt = safeReport.temporalTrends.nervousnessTrend || [];
                            const et = safeReport.temporalTrends.engagementTrend || [];
                            if (ct.length === 0 || nt.length === 0 || et.length === 0) return null;
                            const mid = Math.floor(ct.length / 2);
                            const getVal = (arr: { value: number }[], i: number) => (arr[i]?.value ?? 0.5) * 100;
                            return (
                            <div className="glass rounded-xl border border-white/20 p-6 hover:border-primary/40 transition-all shadow-lg shadow-black/20">
                                <h3 className="text-lg font-semibold text-gray-200 mb-6">Performance Over Time</h3>

                                <div className="h-[250px] w-full">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={[
                                            {
                                                name: 'Start',
                                                Confidence: Math.round(getVal(ct, 0)),
                                                Nervousness: Math.round(getVal(nt, 0)),
                                                Engagement: Math.round(getVal(et, 0))
                                            },
                                            {
                                                name: 'Mid',
                                                Confidence: Math.round(getVal(ct, mid)),
                                                Nervousness: Math.round(getVal(nt, mid)),
                                                Engagement: Math.round(getVal(et, mid))
                                            },
                                            {
                                                name: 'End',
                                                Confidence: Math.round(getVal(ct, ct.length - 1)),
                                                Nervousness: Math.round(getVal(nt, nt.length - 1)),
                                                Engagement: Math.round(getVal(et, et.length - 1))
                                            }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                                            <XAxis dataKey="name" tick={{ fill: 'rgba(148, 163, 184, 0.9)', fontSize: 12 }} />
                                            <YAxis domain={[0, 100]} tick={{ fill: 'rgba(148, 163, 184, 0.9)', fontSize: 12 }} />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'hsl(var(--popover))',
                                                    borderColor: 'hsl(var(--border))',
                                                    color: 'hsl(var(--popover-foreground))',
                                                    borderRadius: '8px',
                                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                                }}
                                            />
                                            <Bar dataKey="Confidence" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Engagement" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                                            <Bar dataKey="Nervousness" fill="rgba(239, 68, 68, 0.8)" radius={[4, 4, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                <div className="mt-4 p-3 rounded-lg bg-white/[0.04] border border-white/10">
                                    <p className="text-xs text-gray-400">
                                        <span className="font-semibold text-gray-300">Trend Analysis:</span> {
                                            ct[ct.length - 1]?.value > ct[0]?.value
                                                ? 'Confidence improved throughout the interview, showing good adaptation and comfort.'
                                                : 'Confidence remained steady, demonstrating consistent performance.'
                                        }
                                    </p>
                                </div>
                            </div>
                            );
                        })()}

                    </div>
                </section>
            )}

            {/* Panelist Feedback */}
            <section className="glass rounded-2xl border border-white/20 px-8 py-10 shadow-lg shadow-black/20">
                <h2 className="text-2xl font-semibold text-gray-200 mb-8">Panelist Remarks</h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {safeReport.panelistComments.map((pc, idx) => (
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
            <section className="glass rounded-2xl border border-white/20 px-8 py-12 shadow-lg shadow-black/20" data-html2canvas-ignore="true">
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
                        onClick={handleShowSampleReport}
                        className="px-10 py-4 bg-transparent border border-white/20 text-gray-200 font-medium rounded-xl hover:bg-white/[0.06] hover:border-white/30 transition-all flex items-center gap-2"
                    >
                        <FileText className="w-5 h-5" />
                        Open Sample Report
                    </button>
                </div>
            </section>

        </motion.div>
    );
};

