import React from 'react';
import { FinalReport } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface Props {
  report: FinalReport;
  onRestart: () => void;
}

export const Dashboard: React.FC<Props> = ({ report, onRestart }) => {
  
  const chartData = [
    { subject: 'Technical', A: report.technicalScore, fullMark: 100 },
    { subject: 'Communication', A: report.communicationScore, fullMark: 100 },
    { subject: 'Culture Fit', A: report.cultureFitScore, fullMark: 100 },
  ];

  const averageScore = Math.round((report.technicalScore + report.communicationScore + report.cultureFitScore) / 3);

  return (
    <div className="max-w-6xl mx-auto p-4 pb-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white mb-2">Assessment Complete</h2>
        <p className="text-slate-400">Here is the consolidated feedback from the AI Panel.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Score Card */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col items-center justify-center">
             <div className="relative w-32 h-32 flex items-center justify-center">
                 <svg className="w-full h-full" viewBox="0 0 36 36">
                    <path
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke="#1e293b"
                        strokeWidth="2"
                    />
                    <path
                        d="M18 2.0845
                        a 15.9155 15.9155 0 0 1 0 31.831
                        a 15.9155 15.9155 0 0 1 0 -31.831"
                        fill="none"
                        stroke={averageScore > 70 ? '#10b981' : averageScore > 40 ? '#f59e0b' : '#ef4444'}
                        strokeWidth="2"
                        strokeDasharray={`${averageScore}, 100`}
                    />
                 </svg>
                 <span className="absolute text-4xl font-bold text-white">{averageScore}</span>
             </div>
             <p className="mt-4 text-slate-300 font-medium">Overall Score</p>
        </div>

        {/* Radar Chart */}
        <div className="bg-slate-800 p-4 rounded-xl border border-slate-700 col-span-2 h-80">
             <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
                <PolarGrid stroke="#475569" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#94a3b8' }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                    name="Candidate"
                    dataKey="A"
                    stroke="#8884d8"
                    strokeWidth={3}
                    fill="#8884d8"
                    fillOpacity={0.5}
                />
                <Tooltip 
                    contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#f1f5f9' }}
                    itemStyle={{ color: '#8884d8' }}
                />
                </RadarChart>
             </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Detailed Feedback */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                  <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
                  Summary Evaluation
              </h3>
              <p className="text-slate-300 leading-relaxed whitespace-pre-line">{report.detailedFeedback}</p>
          </div>

          {/* Key Improvements */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                   <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                   Suggested Improvements
              </h3>
              <ul className="space-y-3">
                  {report.improvements.map((imp, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-slate-300">
                          <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs font-mono text-slate-400">{idx + 1}</span>
                          {imp}
                      </li>
                  ))}
              </ul>
          </div>
      </div>

      {/* Panelist Individual Comments */}
      <div className="mt-8">
          <h3 className="text-xl font-bold text-white mb-6">Panelist Notes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {report.panelistComments.map((pc, idx) => (
                  <div key={idx} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                      <h4 className="font-bold text-slate-200 mb-2">{pc.name}</h4>
                      <p className="text-sm text-slate-400 italic">"{pc.comment}"</p>
                  </div>
              ))}
          </div>
      </div>
      
      <div className="mt-12 text-center">
          <button onClick={onRestart} className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg transition-transform hover:scale-105 shadow-lg shadow-blue-500/30">
              Start New Interview
          </button>
      </div>
    </div>
  );
};
