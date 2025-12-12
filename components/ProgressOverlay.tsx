
import React from 'react';
import { Loader2, Hourglass, CheckCircle2, Zap } from 'lucide-react';

interface Props {
  state: {
     current: number;
     total: number;
     status: 'generating' | 'cooldown' | 'idle';
     countdown: number;
  };
}

const ProgressOverlay: React.FC<Props> = ({ state }) => {
  if (state.status === 'idle') return null;

  const percentage = state.total > 0 ? Math.round((state.current / state.total) * 100) : 0;

  return (
    <div className="absolute bottom-8 right-8 z-50 w-80 bg-slate-900/95 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl p-5 animate-in slide-in-from-bottom-5 fade-in duration-300">
      
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
          <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  {state.status === 'cooldown' ? (
                      <>
                        <Hourglass className="w-4 h-4 text-amber-500 animate-pulse" />
                        Safety Pause
                      </>
                  ) : (
                      <>
                        <Zap className="w-4 h-4 text-blue-500" />
                        Generating...
                      </>
                  )}
              </h3>
              <p className="text-[10px] text-slate-400 mt-1">
                  {state.status === 'cooldown' 
                    ? "Cooling down API to prevent rate limits..." 
                    : `Processing image ${state.current} of ${state.total}`
                  }
              </p>
          </div>
          <div className="text-xs font-mono font-bold text-slate-500">
              {percentage}%
          </div>
      </div>

      {/* Progress Bar or Countdown */}
      <div className="bg-slate-950 rounded-full h-2 w-full overflow-hidden border border-slate-800 relative">
          {state.status === 'cooldown' ? (
              <div 
                className="h-full bg-amber-500 transition-all duration-1000 ease-linear"
                style={{ width: '100%', opacity: 0.8, animation: 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite' }}
              />
          ) : (
              <div 
                className="h-full bg-gradient-to-r from-blue-500 to-blue-400 transition-all duration-300 ease-out"
                style={{ width: `${percentage}%` }}
              />
          )}
      </div>

      {state.status === 'cooldown' && (
          <div className="mt-3 flex justify-center">
              <span className="text-2xl font-mono font-bold text-white">
                  {state.countdown}<span className="text-xs text-slate-500 ml-1">s</span>
              </span>
          </div>
      )}
    </div>
  );
};

export default ProgressOverlay;
