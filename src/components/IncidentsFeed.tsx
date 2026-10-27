import React, { useState } from 'react';
import {
  X,
  Activity,
  CloudLightning,
  Satellite,
  Clock,
  ChevronRight,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import type { EarthquakeFeature, WeatherIncident } from '../types/telemetry.ts';
import type { CalculatedSatellitePosition } from '../utils/satelliteMath.ts';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface IncidentsFeedProps {
  isOpen: boolean;
  onClose: () => void;
  earthquakes: EarthquakeFeature[];
  weatherIncidents: WeatherIncident[];
  satellites: CalculatedSatellitePosition[];
  onSelectEarthquake: (eq: EarthquakeFeature) => void;
  onSelectWeather: (inc: WeatherIncident) => void;
  onSelectSatellite: (sat: CalculatedSatellitePosition) => void;
  onFocus: (lng: number, lat: number, zoom?: number) => void;
}

export const IncidentsFeed: React.FC<IncidentsFeedProps> = ({
  isOpen,
  onClose,
  earthquakes,
  weatherIncidents,
  satellites,
  onSelectEarthquake,
  onSelectWeather,
  onSelectSatellite,
  onFocus,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'SEISMIC' | 'WEATHER' | 'SPACE'>('ALL');

  if (!isOpen) return null;

  // Space Stations for priority feed
  const prioritySats = satellites.filter(
    (s) => s.category === 'Space Station' || s.name.includes('HUBBLE')
  );

  return (
    <aside className="absolute top-14 right-0 bottom-0 z-20 w-80 md:w-88 bg-slate-950/90 backdrop-blur-xl border-l border-red-500/20 text-slate-200 flex flex-col shadow-2xl transition-all font-sans select-none overflow-hidden">
      {/* Header */}
      <div className="h-12 border-b border-slate-800/80 px-4 flex items-center justify-between bg-slate-900/50">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <span className="font-mono text-xs font-bold tracking-wider text-slate-100 uppercase">
            Global Tactical Alerts Feed
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 p-2 bg-slate-900/60 border-b border-slate-800/60 font-mono text-[10px]">
        {(['ALL', 'SEISMIC', 'WEATHER', 'SPACE'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              soundEngine.playClick();
              setFilterType(tab);
            }}
            className={`flex-1 py-1 rounded transition-colors text-center font-semibold ${
              filterType === tab
                ? 'bg-slate-800 text-cyan-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Event Stream */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-xs custom-scrollbar">
        {/* Weather Incidents */}
        {(filterType === 'ALL' || filterType === 'WEATHER') &&
          weatherIncidents.map((inc) => (
            <div
              key={inc.id}
              onClick={() => {
                soundEngine.playRadarPing();
                onSelectWeather(inc);
                onFocus(inc.coordinates[0], inc.coordinates[1], 5);
              }}
              className="bg-slate-900/70 hover:bg-slate-800/80 border border-indigo-500/30 rounded-lg p-2.5 cursor-pointer transition-all hover:border-indigo-400/60 group"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-indigo-400 font-bold text-[11px]">
                  <CloudLightning className="w-3.5 h-3.5" />
                  <span>{inc.category}</span>
                </span>
                <span className="text-[10px] text-slate-500">LIVE</span>
              </div>
              <div className="text-slate-200 font-semibold mt-1 truncate group-hover:text-indigo-300">
                {inc.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                {inc.intensity} &bull; Wind {inc.windSpeedKts} kts
              </div>
            </div>
          ))}

        {/* Priority Earthquakes */}
        {(filterType === 'ALL' || filterType === 'SEISMIC') &&
          earthquakes.slice(0, 15).map((eq) => {
            const mag = eq.properties.mag;
            const isSevere = mag >= 5.0;
            return (
              <div
                key={eq.id}
                onClick={() => {
                  soundEngine.playRadarPing();
                  onSelectEarthquake(eq);
                  onFocus(eq.geometry.coordinates[0], eq.geometry.coordinates[1], 6);
                }}
                className={`bg-slate-900/70 hover:bg-slate-800/80 rounded-lg p-2.5 cursor-pointer transition-all group border ${
                  isSevere
                    ? 'border-red-500/40 bg-red-950/20'
                    : 'border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`font-black text-xs px-1.5 py-0.5 rounded font-mono ${
                      mag >= 5.5
                        ? 'bg-red-500/30 text-red-300 border border-red-500/50'
                        : mag >= 4.0
                        ? 'bg-orange-500/30 text-orange-300 border border-orange-500/40'
                        : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                    }`}
                  >
                    MAG {mag.toFixed(1)}
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Depth {eq.geometry.coordinates[2]} km
                  </span>
                </div>
                <div className="text-slate-200 text-xs font-semibold mt-1.5 truncate group-hover:text-red-300">
                  {eq.properties.place}
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 flex items-center justify-between">
                  <span>{new Date(eq.properties.time).toLocaleTimeString()} UTC</span>
                  {eq.properties.tsunami === 1 && (
                    <span className="text-amber-400 font-bold">TSUNAMI ALERT</span>
                  )}
                </div>
              </div>
            );
          })}

        {/* Space Assets */}
        {(filterType === 'ALL' || filterType === 'SPACE') &&
          prioritySats.map((sat) => (
            <div
              key={sat.id}
              onClick={() => {
                soundEngine.playRadarPing();
                onSelectSatellite(sat);
                onFocus(sat.longitude, sat.latitude, 5);
              }}
              className="bg-slate-900/70 hover:bg-slate-800/80 border border-cyan-500/30 rounded-lg p-2.5 cursor-pointer transition-all hover:border-cyan-400/60 group"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-cyan-400 font-bold text-[11px]">
                  <Satellite className="w-3.5 h-3.5" />
                  <span>{sat.category}</span>
                </span>
                <span className="text-[10px] text-cyan-300/80">#{sat.id}</span>
              </div>
              <div className="text-slate-200 font-semibold mt-1 truncate group-hover:text-cyan-300">
                {sat.name}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                Alt {sat.altitudeKm} km &bull; Vel {sat.velocityKmS} km/s
              </div>
            </div>
          ))}
      </div>
    </aside>
  );
};
