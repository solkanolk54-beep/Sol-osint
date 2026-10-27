import React from 'react';
import {
  X,
  Satellite,
  Activity,
  Plane,
  Ship,
  Sun,
  MapPin,
  Sliders,
  Cpu,
  Layers,
  Database,
  CloudLightning,
  Sparkles,
} from 'lucide-react';
import { BASEMAP_STYLES } from './MapCanvas.tsx';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface ControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // Layers
  showSatellites: boolean;
  setShowSatellites: (v: boolean) => void;
  showOrbits: boolean;
  setShowOrbits: (v: boolean) => void;
  showEarthquakes: boolean;
  setShowEarthquakes: (v: boolean) => void;
  showAviation: boolean;
  setShowAviation: (v: boolean) => void;
  showMaritime: boolean;
  setShowMaritime: (v: boolean) => void;
  showTerminator: boolean;
  setShowTerminator: (v: boolean) => void;
  showIncidents: boolean;
  setShowIncidents: (v: boolean) => void;
  // Filters
  satCategoryFilter: string;
  setSatCategoryFilter: (cat: string) => void;
  minMagnitude: number;
  setMinMagnitude: (mag: number) => void;
  basemapKey: keyof typeof BASEMAP_STYLES;
  setBasemapKey: (k: keyof typeof BASEMAP_STYLES) => void;
  // Stats
  counts: {
    satellites: number;
    earthquakes: number;
    aviation: number;
    maritime: number;
    incidents: number;
  };
  cacheMode: string;
}

export const ControlPanel: React.FC<ControlPanelProps> = ({
  isOpen,
  onClose,
  showSatellites,
  setShowSatellites,
  showOrbits,
  setShowOrbits,
  showEarthquakes,
  setShowEarthquakes,
  showAviation,
  setShowAviation,
  showMaritime,
  setShowMaritime,
  showTerminator,
  setShowTerminator,
  showIncidents,
  setShowIncidents,
  satCategoryFilter,
  setSatCategoryFilter,
  minMagnitude,
  setMinMagnitude,
  basemapKey,
  setBasemapKey,
  counts,
  cacheMode,
}) => {
  if (!isOpen) return null;

  return (
    <aside className="absolute top-14 left-0 bottom-0 z-20 w-80 md:w-88 bg-slate-950/90 backdrop-blur-xl border-r border-cyan-500/20 text-slate-200 flex flex-col shadow-2xl transition-all font-sans select-none overflow-hidden">
      {/* Panel Header */}
      <div className="h-12 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-cyan-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
            Telemetry & Layer Control
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs font-mono custom-scrollbar">
        {/* Layer Toggles Section */}
        <section className="space-y-2.5">
          <div className="text-[11px] text-cyan-400/90 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Primary Spatial Layers</span>
            <span className="text-slate-500 font-normal">GPU ACCEL</span>
          </div>

          {/* SATELLITES */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSatellites}
                  onChange={(e) => {
                    soundEngine.playClick();
                    setShowSatellites(e.target.checked);
                  }}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-cyan-500 focus:ring-0 accent-cyan-500 cursor-pointer"
                />
                <Satellite className="w-4 h-4 text-cyan-400" />
                <span className="font-semibold text-slate-200">Orbital Assets</span>
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800/60 text-cyan-300">
                {counts.satellites} Tracked
              </span>
            </div>

            {showSatellites && (
              <div className="pt-1.5 pl-6 border-t border-slate-800/60 space-y-2 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                  <input
                    type="checkbox"
                    checked={showOrbits}
                    onChange={(e) => {
                      soundEngine.playClick();
                      setShowOrbits(e.target.checked);
                    }}
                    className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-cyan-500 accent-cyan-500 cursor-pointer"
                  />
                  <span>Projected Orbit Trajectories</span>
                </label>

                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px]">Filter Constellation:</span>
                  <select
                    value={satCategoryFilter}
                    onChange={(e) => setSatCategoryFilter(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-slate-200 text-[11px] focus:outline-none focus:border-cyan-500/50"
                  >
                    <option value="ALL">All Orbital Objects ({counts.satellites})</option>
                    <option value="SPACE STATION">Space Stations (ISS / Tiangong)</option>
                    <option value="COMMUNICATIONS">Communications / Starlink</option>
                    <option value="NAVIGATION">Navigation (GPS / Galileo / GLONASS)</option>
                    <option value="SCIENCE & WEATHER">Science & Weather (NOAA / Envisat)</option>
                    <option value="EARTH OBSERVATION">Earth Observation (Landsat / Sentinel)</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* EARTHQUAKES */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showEarthquakes}
                  onChange={(e) => {
                    soundEngine.playClick();
                    setShowEarthquakes(e.target.checked);
                  }}
                  className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-red-500 focus:ring-0 accent-red-500 cursor-pointer"
                />
                <Activity className="w-4 h-4 text-red-400" />
                <span className="font-semibold text-slate-200">Seismic Events</span>
              </label>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-950 border border-red-800/60 text-red-300">
                {counts.earthquakes} Live
              </span>
            </div>

            {showEarthquakes && (
              <div className="pt-1.5 pl-6 border-t border-slate-800/60 space-y-1.5">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Min Richter Magnitude:</span>
                  <span className="text-red-400 font-bold">M {minMagnitude.toFixed(1)}+</span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="6.0"
                  step="0.5"
                  value={minMagnitude}
                  onChange={(e) => setMinMagnitude(parseFloat(e.target.value))}
                  className="w-full accent-red-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>M1.0 (All)</span>
                  <span>M3.5 (Noticeable)</span>
                  <span>M5.5+ (Severe)</span>
                </div>
              </div>
            )}
          </div>

          {/* AVIATION */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showAviation}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowAviation(e.target.checked);
                }}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-sky-500 focus:ring-0 accent-sky-500 cursor-pointer"
              />
              <Plane className="w-4 h-4 text-sky-400" />
              <span className="font-semibold text-slate-200">ADS-B Air Traffic</span>
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950 border border-sky-800/60 text-sky-300">
              {counts.aviation} Flights
            </span>
          </div>

          {/* MARITIME */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showMaritime}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowMaritime(e.target.checked);
                }}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-teal-500 focus:ring-0 accent-teal-500 cursor-pointer"
              />
              <Ship className="w-4 h-4 text-teal-400" />
              <span className="font-semibold text-slate-200">AIS Maritime Fleet</span>
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-950 border border-teal-800/60 text-teal-300">
              {counts.maritime} Vessels
            </span>
          </div>

          {/* DAY/NIGHT TERMINATOR */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTerminator}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowTerminator(e.target.checked);
                }}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-amber-500 focus:ring-0 accent-amber-500 cursor-pointer"
              />
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="font-semibold text-slate-200">Day/Night Solar Shadow</span>
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-800/60 text-amber-300">
              SunCalc
            </span>
          </div>

          {/* METEOROLOGICAL INCIDENTS */}
          <div className="bg-slate-900/70 border border-slate-800/90 rounded-lg p-3 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIncidents}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowIncidents(e.target.checked);
                }}
                className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-indigo-500 focus:ring-0 accent-indigo-500 cursor-pointer"
              />
              <CloudLightning className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold text-slate-200">Severe Storms & Vortex</span>
            </label>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-950 border border-indigo-800/60 text-indigo-300">
              {counts.incidents} Anomalies
            </span>
          </div>
        </section>

        {/* Map Basemap Style Selection */}
        <section className="space-y-2">
          <div className="text-[11px] text-cyan-400/90 font-bold uppercase tracking-wider">
            Cartographic Canvas
          </div>
          <div className="grid grid-cols-1 gap-1.5">
            {Object.entries(BASEMAP_STYLES).map(([key, item]) => (
              <button
                key={key}
                onClick={() => setBasemapKey(key as keyof typeof BASEMAP_STYLES)}
                className={`text-left px-3 py-2 rounded border transition-all text-[11px] ${
                  basemapKey === key
                    ? 'bg-cyan-950/80 border-cyan-500/60 text-cyan-300 font-semibold shadow-sm'
                    : 'bg-slate-900/50 border-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.name}
              </button>
            ))}
          </div>
        </section>

        {/* System & Telemetry Engine Status */}
        <section className="space-y-2 pt-2 border-t border-slate-800/80 text-[10px]">
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            <span>Architecture Telemetry</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 rounded p-2.5 space-y-1.5 text-slate-400">
            <div className="flex justify-between">
              <span>Cache & PubSub:</span>
              <span className="text-emerald-400 uppercase font-mono">{cacheMode}</span>
            </div>
            <div className="flex justify-between">
              <span>Orbital Engine:</span>
              <span className="text-cyan-400 font-mono">SGP4 (satellite.js)</span>
            </div>
            <div className="flex justify-between">
              <span>Astronomical Math:</span>
              <span className="text-amber-400 font-mono">SunCalc Subsolar</span>
            </div>
            <div className="flex justify-between">
              <span>WebGL Renderer:</span>
              <span className="text-indigo-400 font-mono">Deck.gl + MapLibre</span>
            </div>
            <div className="flex justify-between">
              <span>Data Transport:</span>
              <span className="text-emerald-400 font-mono">SSE (Heartbeat 15s)</span>
            </div>
          </div>
        </section>
      </div>
    </aside>
  );
};
