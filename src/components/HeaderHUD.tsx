import React, { useState, useEffect } from 'react';
import {
  Radio,
  Satellite,
  Plane,
  Ship,
  Activity,
  Sun,
  Volume2,
  VolumeX,
  Compass,
  Layers,
  ListFilter,
  ShieldAlert,
  Sprout,
} from 'lucide-react';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface HeaderHUDProps {
  streamStatus: 'connected' | 'connecting' | 'disconnected';
  satelliteCount: number;
  aviationCount: number;
  maritimeCount: number;
  earthquakeCount: number;
  showSatellites: boolean;
  setShowSatellites: (v: boolean) => void;
  showAviation: boolean;
  setShowAviation: (v: boolean) => void;
  showMaritime: boolean;
  setShowMaritime: (v: boolean) => void;
  showEarthquakes: boolean;
  setShowEarthquakes: (v: boolean) => void;
  showTerminator: boolean;
  setShowTerminator: (v: boolean) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (v: boolean) => void;
  isFeedOpen: boolean;
  setIsFeedOpen: (v: boolean) => void;
  isHasadOpen: boolean;
  setIsHasadOpen: (v: boolean) => void;
  hasadParcelsCount: number;
  audioEnabled: boolean;
  setAudioEnabled: (v: boolean) => void;
}

export const HeaderHUD: React.FC<HeaderHUDProps> = ({
  streamStatus,
  satelliteCount,
  aviationCount,
  maritimeCount,
  earthquakeCount,
  showSatellites,
  setShowSatellites,
  showAviation,
  setShowAviation,
  showMaritime,
  setShowMaritime,
  showEarthquakes,
  setShowEarthquakes,
  showTerminator,
  setShowTerminator,
  isSidebarOpen,
  setIsSidebarOpen,
  isFeedOpen,
  setIsFeedOpen,
  isHasadOpen,
  setIsHasadOpen,
  hasadParcelsCount,
  audioEnabled,
  setAudioEnabled,
}) => {
  const [utcTime, setUtcTime] = useState('');
  const [fps, setFps] = useState(60);

  // UTC Military Clock
  useEffect(() => {
    const update = () => {
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const timeStr = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(
        now.getUTCHours()
      )}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())} UTC`;
      setUtcTime(timeStr);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  // Frame Rate Tracker
  useEffect(() => {
    let frameCount = 0;
    let lastTime = performance.now();
    let animId: number;

    const measure = (now: number) => {
      frameCount++;
      if (now - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)));
        frameCount = 0;
        lastTime = now;
      }
      animId = requestAnimationFrame(measure);
    };

    animId = requestAnimationFrame(measure);
    return () => cancelAnimationFrame(animId);
  }, []);

  const toggleAudio = () => {
    const next = !audioEnabled;
    setAudioEnabled(next);
    soundEngine.enabled = next;
    if (next) soundEngine.playClick();
  };

  return (
    <header className="absolute top-0 left-0 right-0 z-30 h-14 bg-slate-950/85 backdrop-blur-md border-b border-cyan-500/20 px-3 md:px-5 flex items-center justify-between text-slate-200 select-none shadow-2xl">
      {/* Brand & Connection Status */}
      <div className="flex items-center gap-3 md:gap-4">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center w-8 h-8 rounded bg-cyan-950/80 border border-cyan-500/50 shadow-cyan-500/30 shadow-sm">
            <Compass className="w-5 h-5 text-cyan-400 animate-[spin_24s_linear_infinite]" />
            <div className="absolute inset-0 rounded border border-cyan-400/20 animate-pulse pointer-events-none" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-sm tracking-wider text-slate-100 flex items-center gap-1">
                SOL<span className="text-cyan-400 font-extrabold">-OSINT</span>
                <span className="text-emerald-400 font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-500/40">
                  HASAD-LIVE
                </span>
              </span>
              <span className="hidden sm:inline-block text-[10px] font-mono text-cyan-400/80 tracking-widest uppercase">
                PRECISION AGRI
              </span>
            </div>
          </div>
        </div>

        {/* Live SSE Status Pill */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-800 text-[11px] font-mono">
          <span
            className={`w-2 h-2 rounded-full ${
              streamStatus === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                : streamStatus === 'connecting'
                ? 'bg-amber-400 animate-ping'
                : 'bg-rose-500'
            }`}
          />
          <span className="text-slate-400 uppercase tracking-tight">
            {streamStatus === 'connected' ? 'SSE STREAM ACTIVE' : streamStatus.toUpperCase()}
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-emerald-400/90">{fps} FPS</span>
        </div>
      </div>

      {/* Layer Quick Toggles */}
      <div className="hidden md:flex items-center gap-1.5 bg-slate-900/70 p-1 rounded border border-slate-800/90 font-mono text-xs">
        <button
          onClick={() => {
            soundEngine.playClick();
            setShowSatellites(!showSatellites);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            showSatellites
              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Toggle Satellites Layer"
        >
          <Satellite className="w-3.5 h-3.5" />
          <span>SATS</span>
          <span className="text-[10px] px-1 rounded bg-slate-800/80 text-cyan-400">{satelliteCount}</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setShowAviation(!showAviation);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            showAviation
              ? 'bg-sky-950/80 text-sky-300 border border-sky-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Toggle Aviation ADS-B Traffic"
        >
          <Plane className="w-3.5 h-3.5" />
          <span>AIR</span>
          <span className="text-[10px] px-1 rounded bg-slate-800/80 text-sky-400">{aviationCount}</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setShowMaritime(!showMaritime);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            showMaritime
              ? 'bg-teal-950/80 text-teal-300 border border-teal-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Toggle Maritime AIS Vessels"
        >
          <Ship className="w-3.5 h-3.5" />
          <span>MARITIME</span>
          <span className="text-[10px] px-1 rounded bg-slate-800/80 text-teal-400">{maritimeCount}</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setShowEarthquakes(!showEarthquakes);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            showEarthquakes
              ? 'bg-red-950/80 text-red-300 border border-red-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Toggle Seismic Earthquakes"
        >
          <Activity className="w-3.5 h-3.5" />
          <span>SEISMIC</span>
          <span className="text-[10px] px-1 rounded bg-slate-800/80 text-red-400">{earthquakeCount}</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setShowTerminator(!showTerminator);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            showTerminator
              ? 'bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-slate-200 border border-transparent'
          }`}
          title="Toggle Solar Day/Night Terminator"
        >
          <Sun className="w-3.5 h-3.5" />
          <span>SOLAR</span>
        </button>

        <button
          onClick={() => {
            soundEngine.playClick();
            setIsHasadOpen(!isHasadOpen);
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all ${
            isHasadOpen
              ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 shadow-sm'
              : 'text-slate-400 hover:text-emerald-300 border border-transparent'
          }`}
          title="HASAD Precision AgriTech Engine"
        >
          <Sprout className="w-3.5 h-3.5 text-emerald-400" />
          <span>HASAD</span>
          <span className="text-[10px] px-1 rounded bg-slate-800/80 text-emerald-400">{hasadParcelsCount}</span>
        </button>
      </div>

      {/* Right Controls: UTC Clock & Panels */}
      <div className="flex items-center gap-2 md:gap-3">
        <div className="font-mono text-xs text-slate-300 bg-slate-900/80 px-2.5 py-1 rounded border border-slate-800 tracking-wider hidden sm:block">
          {utcTime || 'SYNCHRONIZING...'}
        </div>

        {/* Audio Mute/Unmute */}
        <button
          onClick={toggleAudio}
          title={audioEnabled ? 'Mute Audio Alerts' : 'Enable Audio Radar Alerts'}
          className={`w-8 h-8 rounded border flex items-center justify-center transition-all ${
            audioEnabled
              ? 'bg-cyan-950/70 border-cyan-500/40 text-cyan-400'
              : 'bg-slate-900/80 border-slate-800 text-slate-500 hover:text-slate-300'
          }`}
        >
          {audioEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </button>

        {/* HASAD AgriTech Drawer Toggle */}
        <button
          onClick={() => {
            soundEngine.playClick();
            setIsHasadOpen(!isHasadOpen);
          }}
          title="HASAD Precision AgriTech Engine"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs transition-all ${
            isHasadOpen
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <Sprout className="w-4 h-4 text-emerald-400" />
          <span className="hidden xl:inline">HASAD</span>
        </button>

        {/* Incident Feed Toggle */}
        <button
          onClick={() => {
            soundEngine.playClick();
            setIsFeedOpen(!isFeedOpen);
          }}
          title="Live Incident & Event Log"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs transition-all ${
            isFeedOpen
              ? 'bg-red-950/80 border-red-500/50 text-red-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-red-400" />
          <span className="hidden xl:inline">INCIDENTS</span>
        </button>

        {/* Sidebar / Filters Toggle */}
        <button
          onClick={() => {
            soundEngine.playClick();
            setIsSidebarOpen(!isSidebarOpen);
          }}
          title="Layers & Control Panel"
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono text-xs transition-all ${
            isSidebarOpen
              ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300'
              : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:border-slate-700'
          }`}
        >
          <Layers className="w-4 h-4 text-cyan-400" />
          <span className="hidden xl:inline">CONTROL</span>
        </button>
      </div>
    </header>
  );
};
