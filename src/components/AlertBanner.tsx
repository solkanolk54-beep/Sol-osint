import React from 'react';
import { AlertCircle, X, Crosshair } from 'lucide-react';
import type { EarthquakeFeature } from '../types/telemetry.ts';

export interface AlertBannerProps {
  alertEvent: EarthquakeFeature | null;
  onDismiss: () => void;
  onLocate: (eq: EarthquakeFeature) => void;
}

export const AlertBanner: React.FC<AlertBannerProps> = ({ alertEvent, onDismiss, onLocate }) => {
  if (!alertEvent) return null;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 max-w-xl w-[92%] bg-red-950/95 border-2 border-red-500/80 rounded-xl px-4 py-2.5 text-slate-100 shadow-[0_0_30px_rgba(239,68,68,0.4)] backdrop-blur-xl flex items-center justify-between gap-3 animate-bounce select-none font-mono">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-600/30 border border-red-400 flex items-center justify-center shrink-0 animate-pulse">
          <AlertCircle className="w-5 h-5 text-red-400" />
        </div>
        <div>
          <div className="text-[11px] font-bold text-red-300 uppercase tracking-widest flex items-center gap-2">
            <span>PRIORITY SEISMIC ALERT</span>
            <span className="px-1.5 py-0.2 rounded bg-red-900 border border-red-500/50 text-white font-black text-xs">
              M {alertEvent.properties.mag.toFixed(1)}
            </span>
          </div>
          <div className="text-xs text-slate-200 font-semibold truncate max-w-xs md:max-w-md">
            {alertEvent.properties.place}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => onLocate(alertEvent)}
          className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1 transition-all shadow"
        >
          <Crosshair className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">LOCATE</span>
        </button>
        <button
          onClick={onDismiss}
          className="p-1 rounded text-red-400 hover:text-white hover:bg-red-900/60 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
