import React, { useState } from 'react';
import {
  Sprout,
  X,
  Layers,
  CloudRain,
  Radio,
  Sliders,
  Calendar,
  Compass,
  AlertTriangle,
  Droplets,
  Gauge,
  Sparkles,
  FileDown,
} from 'lucide-react';
import type { FieldParcelCollection, IoTSensorNode, HasadAgriHub } from '../types/hasad.ts';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface HasadControlsProps {
  isOpen: boolean;
  onClose: () => void;
  // Layer Switches
  showSentinel: boolean;
  setShowSentinel: (v: boolean) => void;
  showRadar: boolean;
  setShowRadar: (v: boolean) => void;
  showParcels: boolean;
  setShowParcels: (v: boolean) => void;
  showIoT: boolean;
  setShowIoT: (v: boolean) => void;
  // Opacity Controls
  sentinelOpacity: number;
  setSentinelOpacity: (v: number) => void;
  radarOpacity: number;
  setRadarOpacity: (v: number) => void;
  // Historical Sentinel Pass
  selectedDate: string;
  setSelectedDate: (date: string) => void;
  // Agri Hubs & Camera Jump
  hubs: HasadAgriHub[];
  activeHubId: string;
  onSelectHub: (hub: HasadAgriHub) => void;
  // Telemetry Counts
  parcels: FieldParcelCollection | null;
  sensors: IoTSensorNode[];
  onTriggerGlobalIrrigation: () => void;
}

export const HasadControls: React.FC<HasadControlsProps> = ({
  isOpen,
  onClose,
  showSentinel,
  setShowSentinel,
  showRadar,
  setShowRadar,
  showParcels,
  setShowParcels,
  showIoT,
  setShowIoT,
  sentinelOpacity,
  setSentinelOpacity,
  radarOpacity,
  setRadarOpacity,
  selectedDate,
  setSelectedDate,
  hubs,
  activeHubId,
  onSelectHub,
  parcels,
  sensors,
  onTriggerGlobalIrrigation,
}) => {
  if (!isOpen) return null;

  const totalHectares = parcels?.features.reduce((acc, f) => acc + f.properties.areaHectares, 0) || 0;
  const meanNdvi = parcels?.features.length
    ? (parcels.features.reduce((acc, f) => acc + f.properties.ndvi, 0) / parcels.features.length).toFixed(2)
    : '0.00';
  const activeValves = sensors.filter((s) => s.valveState === 'open' || s.valveState === 'flow_pulsing').length;
  const alertSensors = sensors.filter((s) => s.alertActive).length;

  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const handleExportPdf = async () => {
    try {
      setIsExportingPdf(true);
      soundEngine.playRadarPing();
      const res = await fetch('/api/hasad/reports/pdf');
      if (!res.ok) throw new Error('PDF export failed');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HASAD-Executive-Report-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export PDF report:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <aside className="absolute top-14 left-0 md:left-84 bottom-0 z-20 w-84 md:w-92 bg-slate-950/92 backdrop-blur-xl border-r border-emerald-500/30 text-slate-200 flex flex-col shadow-2xl transition-all font-sans select-none overflow-hidden">
      {/* Panel Header */}
      <div className="h-12 border-b border-emerald-500/20 px-4 flex items-center justify-between bg-emerald-950/40">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center">
            <Sprout className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div>
            <h2 className="font-mono text-xs font-bold tracking-wider text-emerald-300 uppercase">
              HASAD AgriTech Engine
            </h2>
            <div className="text-[9px] font-mono text-emerald-400/70">PRECISION SATELLITE & IOT HUD</div>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Controls Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs font-mono custom-scrollbar">
        {/* Quick Executive Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-slate-900/80 border border-emerald-500/20 rounded p-2">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Compass className="w-3 h-3 text-emerald-400" />
              <span>TOTAL CANOPY</span>
            </div>
            <div className="text-sm font-bold text-slate-100 mt-0.5">
              {Math.round(totalHectares).toLocaleString()} <span className="text-[10px] text-slate-400">ha</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/20 rounded p-2">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Gauge className="w-3 h-3 text-emerald-400" />
              <span>MEAN NDVI INDEX</span>
            </div>
            <div className="text-sm font-bold text-emerald-400 mt-0.5">
              {meanNdvi} <span className="text-[10px] text-slate-400">/ 1.0</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/20 rounded p-2">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <Droplets className="w-3 h-3 text-cyan-400" />
              <span>IRRIGATION VALVES</span>
            </div>
            <div className="text-sm font-bold text-cyan-300 mt-0.5">
              {activeValves} Active <span className="text-[10px] text-slate-400">/ {sensors.length}</span>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-emerald-500/20 rounded p-2">
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span>WATER DEFICIT ALERTS</span>
            </div>
            <div className="text-sm font-bold text-red-400 mt-0.5">
              {alertSensors} Parcells Alerting
            </div>
          </div>
        </div>

        {/* Agri Hub Selector */}
        <section className="space-y-1.5">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider flex items-center justify-between">
            <span>Focus Agricultural Hub</span>
            <span className="text-slate-500 font-normal">SATELLITE SECTOR</span>
          </div>
          <div className="grid grid-cols-1 gap-1">
            {hubs.map((hub) => (
              <button
                key={hub.id}
                onClick={() => {
                  soundEngine.playRadarPing();
                  onSelectHub(hub);
                }}
                className={`text-left px-2.5 py-1.5 rounded border transition-all text-[11px] flex items-center justify-between ${
                  activeHubId === hub.id
                    ? 'bg-emerald-950/80 border-emerald-500/60 text-emerald-300 font-semibold shadow-sm'
                    : 'bg-slate-900/60 border-slate-800/80 text-slate-300 hover:text-white hover:border-slate-700'
                }`}
              >
                <div>
                  <div className="font-bold">{hub.name}</div>
                  <div className="text-[9px] text-slate-400">{hub.country} &bull; {hub.hectares.toLocaleString()} ha</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">JUMP &rarr;</span>
              </button>
            ))}
          </div>
        </section>

        {/* Primary HASAD Layers */}
        <section className="space-y-2.5 pt-2 border-t border-slate-800">
          <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">
            Precision Geo-Layers
          </div>

          {/* 1. Sentinel-2 NDVI */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showSentinel}
                  onChange={(e) => {
                    soundEngine.playClick();
                    setShowSentinel(e.target.checked);
                  }}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-emerald-500 accent-emerald-500 cursor-pointer"
                />
                <Layers className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-slate-200">Sentinel-2 / NDVI Composite</span>
              </label>
              <span className="text-[9px] px-1 rounded bg-emerald-950 border border-emerald-800/60 text-emerald-300">
                10m RES
              </span>
            </div>

            {showSentinel && (
              <div className="pl-5 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Imagery Opacity:</span>
                  <span className="text-emerald-400 font-bold">{Math.round(sentinelOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={sentinelOpacity}
                  onChange={(e) => setSentinelOpacity(parseFloat(e.target.value))}
                  className="w-full accent-emerald-500 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* 2. Weather Radar */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 space-y-2">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showRadar}
                  onChange={(e) => {
                    soundEngine.playClick();
                    setShowRadar(e.target.checked);
                  }}
                  className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-sky-500 accent-sky-500 cursor-pointer"
                />
                <CloudRain className="w-3.5 h-3.5 text-sky-400" />
                <span className="font-semibold text-slate-200">RainViewer Weather Radar</span>
              </label>
              <span className="text-[9px] px-1 rounded bg-sky-950 border border-sky-800/60 text-sky-300">
                LIVE 5MIN
              </span>
            </div>

            {showRadar && (
              <div className="pl-5 space-y-1">
                <div className="flex justify-between text-[10px] text-slate-400">
                  <span>Precipitation Opacity:</span>
                  <span className="text-sky-400 font-bold">{Math.round(radarOpacity * 100)}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={radarOpacity}
                  onChange={(e) => setRadarOpacity(parseFloat(e.target.value))}
                  className="w-full accent-sky-500 h-1 bg-slate-800 rounded cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* 3. Farm Parcels 3D */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showParcels}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowParcels(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-emerald-500 accent-emerald-500 cursor-pointer"
              />
              <Sprout className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold text-slate-200">Field Parcels (3D Extruded)</span>
            </label>
            <span className="text-[9px] px-1 rounded bg-slate-800 text-emerald-300">
              {parcels?.features.length || 0} Fields
            </span>
          </div>

          {/* 4. IoT Sensor Nodes */}
          <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showIoT}
                onChange={(e) => {
                  soundEngine.playClick();
                  setShowIoT(e.target.checked);
                }}
                className="w-3.5 h-3.5 rounded bg-slate-800 border-slate-700 text-cyan-500 accent-cyan-500 cursor-pointer"
              />
              <Radio className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold text-slate-200">IoT Telemetry Nodes</span>
            </label>
            <span className="text-[9px] px-1 rounded bg-cyan-950 text-cyan-300">
              {sensors.length} Nodes
            </span>
          </div>
        </section>

        {/* Historical Sentinel Pass Date Selector */}
        <section className="space-y-1.5 pt-2 border-t border-slate-800">
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
            <Calendar className="w-3 h-3 text-emerald-400" />
            <span>Sentinel-2 Pass Timeline</span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: '2026-10-02', label: '2026-10-02 (Live)' },
              { id: '2026-09-28', label: '2026-09-28 (-4d)' },
              { id: '2026-09-23', label: '2026-09-23 (-9d)' },
              { id: '2026-09-15', label: '2026-09-15 (-17d)' },
            ].map((d) => (
              <button
                key={d.id}
                onClick={() => {
                  soundEngine.playClick();
                  setSelectedDate(d.id);
                }}
                className={`py-1 px-2 rounded border text-[10px] text-center transition-all ${
                  selectedDate === d.id
                    ? 'bg-emerald-950 border-emerald-500/60 text-emerald-300 font-bold'
                    : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </section>

        {/* Global Precision Action */}
        <button
          onClick={() => {
            soundEngine.playWarningChirp();
            onTriggerGlobalIrrigation();
          }}
          className="w-full py-2 rounded bg-gradient-to-r from-emerald-600/30 to-cyan-600/30 hover:from-emerald-600/40 hover:to-cyan-600/40 border border-emerald-500/50 text-emerald-200 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-lg"
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
          <span>Synchronize Smart Irrigation Cycle</span>
        </button>

        {/* Export Executive PDF Report Action */}
        <button
          onClick={handleExportPdf}
          disabled={isExportingPdf}
          className="w-full py-2.5 rounded bg-slate-900/90 hover:bg-slate-800 border border-cyan-500/40 hover:border-cyan-400 text-cyan-300 font-mono text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-md group active:scale-[0.98]"
        >
          {isExportingPdf ? (
            <>
              <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span>Generating PDF Intel...</span>
            </>
          ) : (
            <>
              <FileDown className="w-4 h-4 text-cyan-400 group-hover:translate-y-0.5 transition-transform" />
              <span>Export Executive PDF Report</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
};
