import React, { useEffect } from 'react';
import {
  AlertOctagon,
  Droplets,
  Thermometer,
  TrendingDown,
  Zap,
  X,
  Crosshair,
} from 'lucide-react';
import type { ParcelStressAlert } from '../types/irrigation.ts';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface IrrigationAlertBannerProps {
  alert: ParcelStressAlert | null;
  onActuateNow: (alert: ParcelStressAlert) => void;
  onDismiss: (alertId: string) => void;
  onLocateParcel?: (lng: number, lat: number) => void;
}

export const IrrigationAlertBanner: React.FC<IrrigationAlertBannerProps> = ({
  alert,
  onActuateNow,
  onDismiss,
  onLocateParcel,
}) => {
  // Play soft tactical ping whenever a new alert triggers
  useEffect(() => {
    if (alert) {
      soundEngine.playIrrigationAlertPing();
    }
  }, [alert?.id]);

  if (!alert) return null;

  const moisture = alert.soilMoisturePct;
  const temp = alert.ambientTempC;
  const yieldRisk = alert.yieldImpact.estimatedLossPct;
  const economicLoss = alert.yieldImpact.economicLossEstUsd;

  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 w-[95%] max-w-4xl animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto">
      <div className="relative overflow-hidden rounded-xl bg-slate-950/90 backdrop-blur-2xl border border-rose-500/50 shadow-2xl shadow-rose-950/60 text-slate-100 font-sans">
        {/* Animated pulse edge beam */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-400 to-rose-600 animate-pulse" />

        <div className="px-4 py-3 sm:px-5 sm:py-3.5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-4">
          {/* Left badge & identification */}
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="relative shrink-0 w-10 h-10 rounded-lg bg-rose-950/80 border border-rose-500/60 flex items-center justify-center text-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.35)]">
              <AlertOctagon className="w-5 h-5 animate-bounce" />
              <div className="absolute inset-0 rounded-lg border border-rose-400/40 animate-ping pointer-events-none" />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                  CRITICAL HYDRATION ALERT
                </span>
                <span className="text-[10px] font-mono text-slate-400 tracking-wide uppercase">
                  HASAD PRESCRIPTIVE ENGINE
                </span>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <h4 className="font-mono font-bold text-sm text-slate-100 truncate">
                  {alert.parcelName}
                </h4>
                <span className="text-xs font-mono text-emerald-400 bg-emerald-950/50 px-1.5 py-0.2 rounded border border-emerald-500/30">
                  {alert.cropType}
                </span>
              </div>
            </div>
          </div>

          {/* Center telemetry telemetry chips */}
          <div className="grid grid-cols-3 gap-2 w-full md:w-auto font-mono text-xs">
            {/* Moisture */}
            <div className="bg-slate-900/90 border border-rose-500/40 rounded-lg px-2.5 py-1.5 flex flex-col items-center">
              <div className="text-[9px] text-slate-400 flex items-center gap-1">
                <Droplets className="w-3 h-3 text-rose-400" />
                <span>ROOT VWC</span>
              </div>
              <div className="text-sm font-black text-rose-400">
                {moisture}%{' '}
                <span className="text-[9px] font-normal text-slate-400">&lt;18%</span>
              </div>
            </div>

            {/* Microclimate Temp */}
            <div className="bg-slate-900/90 border border-amber-500/40 rounded-lg px-2.5 py-1.5 flex flex-col items-center">
              <div className="text-[9px] text-slate-400 flex items-center gap-1">
                <Thermometer className="w-3 h-3 text-amber-400" />
                <span>AIR TEMP</span>
              </div>
              <div className="text-sm font-black text-amber-300">
                {temp}°C{' '}
                <span className="text-[9px] font-normal text-slate-400">&gt;32°C</span>
              </div>
            </div>

            {/* Yield Risk */}
            <div className="bg-slate-900/90 border border-rose-500/50 rounded-lg px-2.5 py-1.5 flex flex-col items-center">
              <div className="text-[9px] text-rose-300 flex items-center gap-1">
                <TrendingDown className="w-3 h-3 text-rose-400" />
                <span>YIELD RISK</span>
              </div>
              <div className="text-sm font-black text-rose-400">
                -{yieldRisk}%{' '}
                <span className="text-[9px] font-normal text-slate-400">${(economicLoss / 1000).toFixed(1)}k</span>
              </div>
            </div>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            {onLocateParcel && (
              <button
                onClick={() => {
                  soundEngine.playRadarPing();
                  onLocateParcel(alert.coordinates[0], alert.coordinates[1]);
                }}
                className="hidden sm:flex p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-300 border border-slate-700 transition-colors"
                title="Center on stressed parcel"
              >
                <Crosshair className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                soundEngine.playWarningChirp();
                onActuateNow(alert);
              }}
              className="flex-1 md:flex-initial px-4 py-2 rounded-lg bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-slate-950 font-mono font-black text-xs tracking-wider uppercase shadow-[0_0_20px_rgba(16,185,129,0.45)] hover:shadow-[0_0_25px_rgba(6,182,212,0.6)] flex items-center justify-center gap-1.5 transition-all transform active:scale-95"
            >
              <Zap className="w-3.5 h-3.5 fill-current" />
              <span>ACTUATE VALVE NOW</span>
            </button>

            <button
              onClick={() => {
                soundEngine.playClick();
                onDismiss(alert.id);
              }}
              className="p-2 rounded-lg bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 transition-colors"
              title="Dismiss Alert"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
