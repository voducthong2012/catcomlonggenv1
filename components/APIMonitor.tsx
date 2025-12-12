

import React, { useEffect, useState } from 'react';
import { Activity, AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { RateLimitTracker } from '../utils';

interface Props {
  className?: string;
  compact?: boolean;
}

const APIMonitor: React.FC<Props> = ({ className = "", compact = false }) => {
  const [rpm, setRpm] = useState(0);
  const [status, setStatus] = useState<'HEALTHY' | 'WARNING' | 'CRITICAL'>('HEALTHY');

  useEffect(() => {
    const interval = setInterval(() => {
      setRpm(RateLimitTracker.getRPM());
      setStatus(RateLimitTracker.getStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleReset = (e: React.MouseEvent) => {
      e.stopPropagation();
      RateLimitTracker.reset();
      setRpm(0);
      setStatus('HEALTHY');
  };

  const getStatusColor = () => {
    switch (status) {
      case 'CRITICAL': return 'text-red-500';
      case 'WARNING': return 'text-amber-500';
      default: return 'text-green-500';
    }
  };

  const getBarColor = (index: number) => {
    if (index >= 19) return 'bg-red-600 animate-pulse'; // Near 20
    if (index >= 15) return 'bg-amber-500'; // Warning zone
    return 'bg-green-500';
  };

  return (
    <div className={`bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col gap-2 ${className}`}>
      <div className="flex justify-between items-center">
         <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${getStatusColor()}`} />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Tier 1 Monitor</span>
         </div>
         <div className="flex items-center gap-2">
             <span className={`text-xs font-mono font-bold ${getStatusColor()}`}>
                {rpm} / 20 RPM
             </span>
             <button onClick={handleReset} className="text-slate-600 hover:text-slate-300" title="Reset Counter">
                 <RotateCcw className="w-3 h-3" />
             </button>
         </div>
      </div>

      {/* Visual Bar Gauge (20 Segments for Tier 1) */}
      {!compact && (
        <div className="flex gap-0.5 h-2 w-full">
            {[...Array(20)].map((_, i) => (
                <div 
                key={i} 
                className={`flex-1 rounded-sm transition-all duration-300 ${i < rpm ? getBarColor(i) : 'bg-slate-800'}`} 
                />
            ))}
        </div>
      )}

      {/* Status Text */}
      <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-500">Usage Load</span>
          {status === 'CRITICAL' ? (
              <span className="flex items-center gap-1 text-red-500 font-bold animate-pulse">
                  <AlertTriangle className="w-3 h-3" /> MAX LIMIT
              </span>
          ) : status === 'WARNING' ? (
              <span className="flex items-center gap-1 text-amber-500 font-bold">
                  <AlertTriangle className="w-3 h-3" /> HEAVY LOAD
              </span>
          ) : (
              <span className="flex items-center gap-1 text-green-500 font-bold">
                  <CheckCircle className="w-3 h-3" /> NORMAL
              </span>
          )}
      </div>
    </div>
  );
};

export default APIMonitor;