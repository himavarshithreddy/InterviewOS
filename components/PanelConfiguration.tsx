import React from 'react';
import { Panelist, AvatarColor } from '../types';
import { AVATAR_COLOR_CLASSES } from '../src/constants';

interface Props {
  panelists: Panelist[];
  onPanelistChange: (index: number, updatedPanelist: Panelist) => void;
  onConfirm: () => void;
}

export const PanelConfiguration: React.FC<Props> = ({ panelists, onPanelistChange, onConfirm }) => {
  const getColorClasses = (color: string) => {
    return AVATAR_COLOR_CLASSES[color as AvatarColor] || AVATAR_COLOR_CLASSES.blue;
  };

  return (
    <div className="max-w-6xl mx-auto bg-slate-800 rounded-xl p-8 border border-slate-700">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Configure Your Interview Panel</h2>
        <p className="text-slate-400">
          AI has generated these interviewers based on your target role. Customize them to fit your specific needs.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {panelists.map((p, index) => {
          const colorClasses = getColorClasses(p.avatarColor);

          return (
            <div
              key={p.id}
              className={`bg-slate-900 rounded-lg border-t-4 ${colorClasses.borderTop} flex flex-col shadow-lg`}
            >
              <div className="p-4 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-full ${colorClasses.bg} flex items-center justify-center font-bold text-white`}>
                    {p.name[0]}
                  </div>
                  <div className="flex-1">
                    <input
                      value={p.name}
                      onChange={(e) => onPanelistChange(index, { ...p, name: e.target.value })}
                      className="bg-transparent text-white font-bold border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none w-full"
                      placeholder="Name"
                    />
                    <input
                      value={p.role}
                      onChange={(e) => onPanelistChange(index, { ...p, role: e.target.value })}
                      className="bg-transparent text-xs font-bold uppercase text-slate-500 border-b border-transparent hover:border-slate-600 focus:border-blue-500 focus:outline-none w-full"
                      placeholder="Role"
                    />
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-4 flex-grow">
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold block mb-1">
                    Primary Focus
                  </label>
                  <input
                    value={p.focus}
                    onChange={(e) => onPanelistChange(index, { ...p, focus: e.target.value })}
                    className="w-full bg-slate-800 text-slate-200 text-sm p-2 rounded border border-slate-700 focus:border-blue-500 focus:outline-none"
                    placeholder="e.g., System Design, Algorithms"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 uppercase font-bold block mb-1">
                    Behavior & Style
                  </label>
                  <textarea
                    value={p.description}
                    onChange={(e) => onPanelistChange(index, { ...p, description: e.target.value })}
                    className="w-full bg-slate-800 text-slate-300 text-sm p-2 rounded border border-slate-700 focus:border-blue-500 focus:outline-none h-32 resize-none"
                    placeholder="Describe questioning style and personality..."
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-blue-900/20 border border-blue-800 p-4 rounded-lg mb-8 text-sm text-blue-200 flex items-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <span>
          <strong>Tip:</strong> You can edit the "Behavior & Style" to change how aggressive, technical, or casual each interviewer acts during the live interview.
        </span>
      </div>

      <div className="flex justify-center">
        <button
          onClick={onConfirm}
          className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-bold rounded-lg transition-all hover:scale-105 shadow-lg hover:shadow-green-500/50"
        >
          Confirm Panel & Start Interview
        </button>
      </div>
    </div>
  );
};
