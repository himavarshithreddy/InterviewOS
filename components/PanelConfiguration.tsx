import React from 'react';
import { motion } from 'framer-motion';
import { Panelist, AvatarColor } from '@/types';
import { AVATAR_COLOR_CLASSES } from '@/src/constants';
import { Sparkles, User, AlertCircle, ArrowRight } from 'lucide-react';

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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-full px-8 md:px-12 pb-24"
      style={{ paddingTop: '2.5rem' }}
    >
      {/* Header */}
      <div className="text-center mb-20">
        <h1 className="text-4xl font-semibold mb-6 text-foreground">
          Your Panel, Your Rules
        </h1>
        <p className="text-muted-foreground max-w-2xl mx-auto text-lg leading-relaxed">
          Hand-picked for your role. Tweak their style, dial the pressure, and make them yours.
        </p>
      </div>

      {/* Panelist cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 max-w-[96rem] mx-auto mb-16">
        {panelists.map((p, index) => {
          const colorClasses = getColorClasses(p.avatarColor);

          return (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              key={p.id}
              className="glass rounded-xl border border-white/20 overflow-hidden flex flex-col shadow-lg shadow-black/20 hover:border-primary/40 transition-colors duration-200"
            >
              {/* Card header */}
              <div className="p-8 border-b border-white/10">
                <div className="flex items-center gap-5">
                  <div className={`w-12 h-12 rounded-xl ${colorClasses.bg} flex items-center justify-center font-semibold text-white text-lg shrink-0`}>
                    {p.name[0]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <input
                      value={p.name}
                      onChange={(e) => onPanelistChange(index, { ...p, name: e.target.value })}
                      className="bg-transparent text-gray-200 font-medium text-lg border-none p-0 focus:ring-0 w-full placeholder-gray-500"
                      placeholder="Name"
                    />
                    <input
                      value={p.role}
                      onChange={(e) => onPanelistChange(index, { ...p, role: e.target.value })}
                      className="bg-transparent text-sm font-medium uppercase tracking-wider text-gray-400 border-none p-0 focus:ring-0 w-full mt-1 placeholder-gray-500"
                      placeholder="Role"
                    />
                  </div>
                </div>
              </div>

              {/* Card body */}
              <div className="p-8 space-y-6 flex-1 flex flex-col">
                <div>
                  <label className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80 mb-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Primary Focus
                  </label>
                  <input
                    value={p.focus}
                    onChange={(e) => onPanelistChange(index, { ...p, focus: e.target.value })}
                    className="w-full h-12 px-4 bg-transparent border border-white/20 rounded-xl text-gray-200 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all"
                    placeholder="e.g., System Design, Algorithms"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs font-medium uppercase tracking-[0.2em] text-primary/80 mb-3 flex items-center gap-2">
                    <User className="w-3.5 h-3.5" />
                    Behavior & Style
                  </label>
                  <textarea
                    value={p.description}
                    onChange={(e) => onPanelistChange(index, { ...p, description: e.target.value })}
                    className="panel-style-textarea w-full min-h-44 px-4 py-3 bg-transparent border border-white/20 rounded-xl text-gray-400 text-sm placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/50 transition-all resize-none leading-relaxed overflow-y-auto"
                    placeholder="Describe questioning style..."
                  />
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Pro tip */}
      <div className="max-w-3xl mx-auto mb-16">
        <div className="flex items-start gap-4 p-6 rounded-xl bg-white/[0.04] border border-white/10">
          <AlertCircle className="w-5 h-5 shrink-0 text-primary/80" />
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="font-medium text-primary/90">Pro Tip:</span> Adjust "Behavior & Style" to change the interviewer's personality.
            Use terms like "aggressive", "supportive", "deep-diver", or "skeptical" to simulate different pressure levels.
          </p>
        </div>
      </div>

      {/* CTA button */}
      <div className="flex justify-center pt-4">
        <button
          onClick={onConfirm}
          className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground h-14 rounded-xl px-10 text-lg font-medium shadow-lg hover:bg-primary/90 hover:shadow-xl active:scale-[0.98] transition-all duration-200"
        >
          Confirm Panel & Start Interview
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
};
