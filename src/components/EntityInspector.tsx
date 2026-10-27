import React, { useState } from 'react';
import {
  X,
  Satellite,
  Activity,
  Plane,
  Ship,
  CloudLightning,
  Crosshair,
  ExternalLink,
  Navigation,
  Globe,
  Gauge,
  Layers,
  Clock,
  Sprout,
  Radio,
  Droplets,
  Thermometer,
  Wind,
  AlertTriangle,
  Battery,
  Wifi,
  Sparkles,
  Compass,
  Zap,
  Timer,
  Play,
  Square,
} from 'lucide-react';
import type { CalculatedSatellitePosition } from '../utils/satelliteMath.ts';
import type { EarthquakeFeature, TelemetryFeature, WeatherIncident } from '../types/telemetry.ts';
import type { FieldParcelFeature, IoTSensorNode } from '../types/hasad.ts';
import { soundEngine } from '../utils/audioAlerts.ts';

export interface EntityInspectorProps {
  selectedSat: CalculatedSatellitePosition | null;
  selectedEarthquake: EarthquakeFeature | null;
  selectedTelemetry: TelemetryFeature | null;
  selectedIncident: WeatherIncident | null;
  selectedParcel?: FieldParcelFeature | null;
  selectedSensor?: IoTSensorNode | null;
  onClose: () => void;
  onFocusCoordinates: (lng: number, lat: number, zoom?: number) => void;
  onToggleValve?: (sensorId: string) => void;
  onActuateValve?: (
    parcelId: string,
    valveId?: string,
    action?: 'OPEN' | 'CLOSE',
    durationMinutes?: number
  ) => Promise<void> | void;
}

export const EntityInspector: React.FC<EntityInspectorProps> = ({
  selectedSat,
  selectedEarthquake,
  selectedTelemetry,
  selectedIncident,
  selectedParcel,
  selectedSensor,
  onClose,
  onFocusCoordinates,
  onToggleValve,
  onActuateValve,
}) => {
  const [pulseDuration, setPulseDuration] = useState<number>(30);
  const [isActuating, setIsActuating] = useState<boolean>(false);
  const hasSelection =
    selectedSat ||
    selectedEarthquake ||
    selectedTelemetry ||
    selectedIncident ||
    selectedParcel ||
    selectedSensor;

  if (!hasSelection) return null;

  return (
    <div className="absolute bottom-6 right-4 md:right-16 z-20 w-88 md:w-96 bg-slate-950/92 backdrop-blur-xl border border-cyan-500/30 rounded-xl text-slate-200 shadow-2xl overflow-hidden font-sans select-none">
      {/* 1. HASAD FIELD PARCEL INSPECTION */}
      {selectedParcel && (
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-emerald-950/90 to-slate-900 px-4 py-3 border-b border-emerald-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-emerald-900/60 border border-emerald-400/40 flex items-center justify-center">
                <Sprout className="w-4 h-4 text-emerald-300" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-emerald-200 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedParcel.properties.name}
                </h3>
                <span className="text-[10px] font-mono text-emerald-400/80 uppercase">
                  {selectedParcel.properties.sector} &bull; {selectedParcel.properties.cropType}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            {/* Health & NDVI Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-emerald-400" />
                  <span>NDVI VEGETATION</span>
                </div>
                <div className="text-sm font-bold text-emerald-400 mt-0.5 flex items-center justify-between">
                  <span>{selectedParcel.properties.ndvi.toFixed(2)}</span>
                  <span
                    className={`text-[9px] px-1 py-0.2 rounded uppercase ${
                      selectedParcel.properties.healthStatus === 'optimal'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                        : selectedParcel.properties.healthStatus === 'warning'
                        ? 'bg-amber-950 text-amber-300 border border-amber-800'
                        : 'bg-red-950 text-red-300 border border-red-800'
                    }`}
                  >
                    {selectedParcel.properties.healthStatus}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Droplets className="w-3 h-3 text-cyan-400" />
                  <span>SOIL MOISTURE</span>
                </div>
                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                  {selectedParcel.properties.soilMoisturePct}%{' '}
                  <span className="text-[10px] text-slate-400 font-normal">volumetric</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-emerald-400" />
                  <span>FIELD AREA</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedParcel.properties.areaHectares}{' '}
                  <span className="text-[10px] text-slate-400 font-normal">ha</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Thermometer className="w-3 h-3 text-amber-400" />
                  <span>ROOT ZONE TEMP</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedParcel.properties.soilTempC}°C{' '}
                  <span className="text-[10px] text-slate-400 font-normal">EC: {selectedParcel.properties.electricalConductivity}</span>
                </div>
              </div>
            </div>

            {/* Weather Summary Card */}
            <div className="bg-slate-900/60 border border-slate-800 rounded p-2.5 space-y-1.5 text-[11px]">
              <div className="text-[10px] text-slate-400 font-bold uppercase flex items-center justify-between">
                <span>Microclimate Forecast</span>
                <span className="text-emerald-400">Station Active</span>
              </div>
              <div className="grid grid-cols-4 gap-1 text-center">
                <div className="bg-slate-950 p-1 rounded">
                  <div className="text-[9px] text-slate-500">AIR TEMP</div>
                  <div className="font-bold text-slate-200">{selectedParcel.properties.weatherSummary.ambientTempC}°C</div>
                </div>
                <div className="bg-slate-950 p-1 rounded">
                  <div className="text-[9px] text-slate-500">HUMIDITY</div>
                  <div className="font-bold text-slate-200">{selectedParcel.properties.weatherSummary.humidityPct}%</div>
                </div>
                <div className="bg-slate-950 p-1 rounded">
                  <div className="text-[9px] text-slate-500">WIND</div>
                  <div className="font-bold text-slate-200">{selectedParcel.properties.weatherSummary.windSpeedKmh} km/h</div>
                </div>
                <div className="bg-slate-950 p-1 rounded">
                  <div className="text-[9px] text-slate-500">RAIN PROB</div>
                  <div className="font-bold text-sky-400">{selectedParcel.properties.weatherSummary.rainProbabilityPct}%</div>
                </div>
              </div>
            </div>

            {/* Direct Solenoid Valve Actuation Control */}
            <div className="bg-slate-900/90 border border-cyan-500/30 rounded-lg p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300 uppercase">
                  <Zap className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Solenoid Actuator Hub</span>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold uppercase ${
                    selectedParcel.properties.irrigationStatus === 'active'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {selectedParcel.properties.irrigationStatus === 'active' ? 'VALVE OPEN (175 L/M)' : 'VALVE IDLE'}
                </span>
              </div>

              {/* Duration pulse presets */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-400">
                  <span className="flex items-center gap-1">
                    <Timer className="w-3 h-3 text-cyan-400" />
                    <span>PULSE DURATION:</span>
                  </span>
                  <span className="font-bold text-cyan-300">
                    {pulseDuration} MIN ({Math.round(175 * pulseDuration).toLocaleString()} L)
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {[15, 30, 45, 60].map((mins) => (
                    <button
                      key={mins}
                      onClick={() => {
                        soundEngine.playClick();
                        setPulseDuration(mins);
                      }}
                      className={`py-1 rounded text-[11px] font-mono transition-all ${
                        pulseDuration === mins
                          ? 'bg-cyan-500/30 border border-cyan-400 text-cyan-200 font-bold shadow-sm'
                          : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Action trigger button */}
              <div className="flex gap-2 pt-0.5">
                {onActuateValve && (
                  <button
                    disabled={isActuating}
                    onClick={async () => {
                      setIsActuating(true);
                      const isCurrentlyActive = selectedParcel.properties.irrigationStatus === 'active';
                      const nextAction = isCurrentlyActive ? 'CLOSE' : 'OPEN';
                      soundEngine.playWarningChirp();
                      await onActuateValve(selectedParcel.id, undefined, nextAction, pulseDuration);
                      setIsActuating(false);
                    }}
                    className={`flex-1 py-2 rounded-lg font-mono text-xs font-bold uppercase transition-all shadow-md flex items-center justify-center gap-1.5 ${
                      selectedParcel.properties.irrigationStatus === 'active'
                        ? 'bg-rose-600/30 hover:bg-rose-600/50 border border-rose-500 text-rose-200'
                        : 'bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-slate-950 shadow-emerald-500/20'
                    }`}
                  >
                    {selectedParcel.properties.irrigationStatus === 'active' ? (
                      <>
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>{isActuating ? 'SHUTTING OFF...' : 'SHUT OFF SOLENOID'}</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>{isActuating ? 'ACTUATING...' : `ACTUATE ${pulseDuration}M CYCLE`}</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Direct Map Focus Action */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  soundEngine.playRadarPing();
                  const coords = selectedParcel.geometry.coordinates[0];
                  const avgLng = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
                  const avgLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;
                  onFocusCoordinates(avgLng, avgLat, 14);
                }}
                className="flex-1 py-2 rounded bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/50 text-emerald-300 flex items-center justify-center gap-1.5 font-mono text-xs font-semibold transition-all shadow-sm"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Focus Field Center</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. HASAD IOT SENSOR INSPECTION */}
      {selectedSensor && (
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-cyan-950/90 to-slate-900 px-4 py-3 border-b border-cyan-500/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-cyan-900/60 border border-cyan-400/40 flex items-center justify-center">
                <Radio className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-cyan-200 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedSensor.name}
                </h3>
                <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
                  {selectedSensor.nodeType.replace('_', ' ')} &bull; Parcel #{selectedSensor.parcelId}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400">ROOT MOISTURE (20cm)</span>
                <div className="text-sm font-bold text-cyan-300 mt-0.5">
                  {selectedSensor.soilMoisture20cm}%
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400">SUBSURFACE (60cm)</span>
                <div className="text-sm font-bold text-sky-300 mt-0.5">
                  {selectedSensor.soilMoisture60cm}%
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400">VALVE ACTUATOR</span>
                <div className="text-sm font-bold mt-0.5 uppercase flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      selectedSensor.valveState === 'open' || selectedSensor.valveState === 'flow_pulsing'
                        ? 'bg-emerald-400 animate-pulse'
                        : 'bg-slate-500'
                    }`}
                  />
                  <span
                    className={
                      selectedSensor.valveState === 'open' || selectedSensor.valveState === 'flow_pulsing'
                        ? 'text-emerald-400'
                        : 'text-slate-400'
                    }
                  >
                    {selectedSensor.valveState.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800 rounded p-2">
                <span className="text-[10px] text-slate-400">FLOW RATE</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedSensor.flowRateLpm} <span className="text-[10px] text-slate-400">L/min</span>
                </div>
              </div>
            </div>

            {/* Signal & Hardware Health */}
            <div className="bg-slate-900/60 border border-slate-800 rounded px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="flex items-center gap-1 text-slate-400">
                <Battery className="w-3.5 h-3.5 text-emerald-400" />
                <span>{selectedSensor.batteryPct}% LiFePO4</span>
              </span>
              <span className="flex items-center gap-1 text-slate-400">
                <Wifi className="w-3.5 h-3.5 text-cyan-400" />
                <span>LoRaWAN {selectedSensor.signalDbm} dBm</span>
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => {
                  soundEngine.playRadarPing();
                  onFocusCoordinates(selectedSensor.coordinates[0], selectedSensor.coordinates[1], 15);
                }}
                className="flex-1 py-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 flex items-center justify-center gap-1.5 font-mono text-xs font-semibold transition-all"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Center Sensor</span>
              </button>

              {onToggleValve && (
                <button
                  onClick={() => {
                    soundEngine.playWarningChirp();
                    onToggleValve(selectedSensor.id);
                  }}
                  className="px-3 py-2 rounded bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-400 text-emerald-200 font-mono text-xs font-bold transition-all"
                  title="Toggle Valve Solenoid"
                >
                  ACTUATE
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. SATELLITE INSPECTION */}
      {selectedSat && (
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-cyan-950/80 to-slate-900 px-4 py-3 border-b border-cyan-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded bg-cyan-900/60 border border-cyan-400/40 flex items-center justify-center">
                <Satellite className="w-4 h-4 text-cyan-300" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-cyan-200 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedSat.name}
                </h3>
                <span className="text-[10px] font-mono text-cyan-400/80 uppercase">
                  NORAD #{selectedSat.id} &bull; {selectedSat.category}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            {/* Grid Metrics */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Gauge className="w-3 h-3 text-cyan-400" />
                  <span>ORBIT ALTITUDE</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedSat.altitudeKm.toLocaleString()} <span className="text-[10px] text-slate-400">km</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Navigation className="w-3 h-3 text-cyan-400" />
                  <span>ORBITAL VELOCITY</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedSat.velocityKmS} <span className="text-[10px] text-slate-400">km/s</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Globe className="w-3 h-3 text-cyan-400" />
                  <span>INCLINATION</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedSat.inclination.toFixed(2)}°
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <div className="text-[10px] text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-cyan-400" />
                  <span>ORBIT PERIOD</span>
                </div>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedSat.periodMinutes} <span className="text-[10px] text-slate-400">min</span>
                </div>
              </div>
            </div>

            {/* Coordinates */}
            <div className="bg-slate-900/60 border border-slate-800 rounded px-3 py-2 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">Ground Subpoint:</span>
              <span className="text-cyan-300 font-semibold">
                {selectedSat.latitude.toFixed(2)}°, {selectedSat.longitude.toFixed(2)}°
              </span>
            </div>

            {/* Actions */}
            <button
              onClick={() => {
                soundEngine.playRadarPing();
                onFocusCoordinates(selectedSat.longitude, selectedSat.latitude, 5);
              }}
              className="w-full py-2 rounded bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/50 text-cyan-300 flex items-center justify-center gap-2 font-mono text-xs font-semibold transition-all shadow-sm"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Camera On Satellite</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. EARTHQUAKE INSPECTION */}
      {selectedEarthquake && (
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-red-950/80 to-slate-900 px-4 py-3 border-b border-red-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-red-900/60 border border-red-500/40 flex items-center justify-center font-mono font-black text-red-300 text-sm">
                M{selectedEarthquake.properties.mag.toFixed(1)}
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-red-200 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedEarthquake.properties.place}
                </h3>
                <span className="text-[10px] font-mono text-red-400/80 uppercase">
                  USGS SEISMIC EVENT &bull; {selectedEarthquake.properties.status.toUpperCase()}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">DEPTH</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedEarthquake.geometry.coordinates[2]} <span className="text-[10px] text-slate-400">km</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">TSUNAMI STATUS</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedEarthquake.properties.tsunami === 1 ? (
                    <span className="text-amber-400 font-bold">WARNING ISSUED</span>
                  ) : (
                    <span className="text-emerald-400 font-normal">NONE DETECTED</span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => {
                  soundEngine.playRadarPing();
                  onFocusCoordinates(
                    selectedEarthquake.geometry.coordinates[0],
                    selectedEarthquake.geometry.coordinates[1],
                    6
                  );
                }}
                className="flex-1 py-2 rounded bg-red-600/20 hover:bg-red-600/30 border border-red-500/50 text-red-300 flex items-center justify-center gap-1.5 font-mono text-xs font-semibold transition-all"
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>Locate Epicenter</span>
              </button>

              {selectedEarthquake.properties.url && (
                <a
                  href={selectedEarthquake.properties.url}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-2 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center transition-all"
                  title="View USGS Official Report"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 5. TELEMETRY INSPECTION (AVIATION / MARITIME) */}
      {selectedTelemetry && (
        <div className="flex flex-col">
          <div
            className={`px-4 py-3 border-b flex items-center justify-between ${
              selectedTelemetry.properties.category === 'aviation'
                ? 'bg-gradient-to-r from-sky-950/80 to-slate-900 border-sky-500/20'
                : 'bg-gradient-to-r from-teal-950/80 to-slate-900 border-teal-500/20'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded border flex items-center justify-center ${
                  selectedTelemetry.properties.category === 'aviation'
                    ? 'bg-sky-900/60 border-sky-400/40 text-sky-300'
                    : 'bg-teal-900/60 border-teal-400/40 text-teal-300'
                }`}
              >
                {selectedTelemetry.properties.category === 'aviation' ? (
                  <Plane className="w-4 h-4" />
                ) : (
                  <Ship className="w-4 h-4" />
                )}
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-slate-100 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedTelemetry.properties.callsign}
                </h3>
                <span className="text-[10px] font-mono text-slate-400 uppercase">
                  {selectedTelemetry.properties.subType}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">GROUND SPEED</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedTelemetry.properties.speedKts} <span className="text-[10px] text-slate-400">kts</span>
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">TRUE HEADING</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedTelemetry.properties.heading}°
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playRadarPing();
                onFocusCoordinates(
                  selectedTelemetry.geometry.coordinates[0],
                  selectedTelemetry.geometry.coordinates[1],
                  6
                );
              }}
              className="w-full py-2 rounded bg-sky-600/20 hover:bg-sky-600/30 border border-sky-500/50 text-sky-300 flex items-center justify-center gap-2 font-mono text-xs font-semibold transition-all"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Camera On Target</span>
            </button>
          </div>
        </div>
      )}

      {/* 6. WEATHER ANOMALY INSPECTION */}
      {selectedIncident && (
        <div className="flex flex-col">
          <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 px-4 py-3 border-b border-indigo-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded bg-indigo-900/60 border border-indigo-400/40 flex items-center justify-center text-indigo-300">
                <CloudLightning className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-mono font-bold text-sm text-indigo-200 tracking-wide leading-tight truncate max-w-[200px]">
                  {selectedIncident.name}
                </h3>
                <span className="text-[10px] font-mono text-indigo-400/80 uppercase">
                  {selectedIncident.category}
                </span>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-4 space-y-3 font-mono text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">INTENSITY</span>
                <div className="text-xs font-bold text-slate-100 mt-0.5 truncate">
                  {selectedIncident.intensity}
                </div>
              </div>

              <div className="bg-slate-900/80 border border-slate-800/90 rounded p-2">
                <span className="text-[10px] text-slate-400">MAX SUSTAINED WIND</span>
                <div className="text-sm font-bold text-slate-100 mt-0.5">
                  {selectedIncident.windSpeedKts} <span className="text-[10px] text-slate-400">kts</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                soundEngine.playRadarPing();
                onFocusCoordinates(selectedIncident.coordinates[0], selectedIncident.coordinates[1], 5);
              }}
              className="w-full py-2 rounded bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/50 text-indigo-300 flex items-center justify-center gap-2 font-mono text-xs font-semibold transition-all"
            >
              <Crosshair className="w-3.5 h-3.5" />
              <span>Center Camera On Weather System</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
