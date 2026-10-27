import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as maplibregl from 'maplibre-gl';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { createSatelliteLayers } from './layers/SatelliteLayers.ts';
import { createEarthquakeLayers } from './layers/EarthquakeLayers.ts';
import { createDayNightLayer } from './layers/DayNightLayer.ts';
import { createTelemetryLayers } from './layers/TelemetryLayers.ts';
import { createIncidentLayers } from './layers/IncidentLayers.ts';

// HASAD AgriTech Layers
import { createHasadSentinelLayer } from './layers/HasadSentinelLayer.ts';
import { createHasadWeatherLayer } from './layers/HasadWeatherLayer.ts';
import { createHasadParcelsLayer } from './layers/HasadParcelsLayer.ts';
import { createHasadIoTLayer } from './layers/HasadIoTLayer.ts';

import type { CalculatedSatellitePosition, OrbitPathSegment } from '../utils/satelliteMath.ts';
import type {
  EarthquakeFeature,
  TelemetryFeature,
  GeoJsonPolygon,
  WeatherIncident,
} from '../types/telemetry.ts';
import type {
  FieldParcelCollection,
  FieldParcelFeature,
  IoTSensorNode,
  RainViewerData,
} from '../types/hasad.ts';

// Configure MapLibre GL worker URL explicitly to resolve bundled environment paths
if (typeof window !== 'undefined') {
  try {
    if (typeof (maplibregl as any).setWorkerUrl === 'function') {
      (maplibregl as any).setWorkerUrl('/maplibre-gl-worker.mjs');
    }
  } catch (err) {
    console.warn('[MapLibre] Could not set worker URL:', err);
  }
}

// Keyless, robust dark basemap styles
export const BASEMAP_STYLES = {
  cartoDark: {
    name: 'CARTO Dark Matter (Vector)',
    style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  },
  esriDark: {
    name: 'Esri Dark Canvas',
    style: {
      version: 8,
      sources: {
        'esri-dark': {
          type: 'raster',
          tiles: ['https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'],
          tileSize: 256,
          attribution: 'Esri, DeLorme, NAVTEQ',
        },
      },
      layers: [
        {
          id: 'esri-dark-layer',
          type: 'raster',
          source: 'esri-dark',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
  cartoRaster: {
    name: 'CARTO Dark (Raster)',
    style: {
      version: 8,
      sources: {
        'carto-dark-raster': {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
            'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          ],
          tileSize: 256,
          attribution: '© OpenStreetMap, © CARTO',
        },
      },
      layers: [
        {
          id: 'carto-dark-layer',
          type: 'raster',
          source: 'carto-dark-raster',
          minzoom: 0,
          maxzoom: 19,
        },
      ],
    },
  },
};

export interface MapCanvasProps {
  satellites: CalculatedSatellitePosition[];
  selectedSat: CalculatedSatellitePosition | null;
  orbitSegments: OrbitPathSegment[];
  earthquakes: EarthquakeFeature[];
  selectedEarthquake: EarthquakeFeature | null;
  telemetry: TelemetryFeature[];
  selectedTelemetry: TelemetryFeature | null;
  weatherIncidents: WeatherIncident[];
  selectedIncident: WeatherIncident | null;
  terminatorData: GeoJsonPolygon | null;
  // Layer toggles
  showSatellites: boolean;
  showOrbits: boolean;
  showEarthquakes: boolean;
  showAviation: boolean;
  showMaritime: boolean;
  showTerminator: boolean;
  showIncidents: boolean;
  // HASAD AgriTech Engine Props
  hasadParcels: FieldParcelCollection | null;
  selectedParcel: FieldParcelFeature | null;
  hasadSensors: IoTSensorNode[];
  selectedSensor: IoTSensorNode | null;
  hasadRadar: RainViewerData | null;
  showHasadSentinel: boolean;
  showHasadWeather: boolean;
  showHasadParcels: boolean;
  showHasadIoT: boolean;
  sentinelOpacity: number;
  radarOpacity: number;
  selectedDate: string;
  onSelectParcel: (parcel: FieldParcelFeature) => void;
  onSelectSensor: (sensor: IoTSensorNode) => void;
  // Filters & Cartography
  satCategoryFilter: string;
  minMagnitude: number;
  basemapKey: keyof typeof BASEMAP_STYLES;
  // Callbacks
  onSelectSatellite: (sat: CalculatedSatellitePosition) => void;
  onSelectEarthquake: (eq: EarthquakeFeature) => void;
  onSelectTelemetry: (t: TelemetryFeature) => void;
  onSelectIncident: (inc: WeatherIncident) => void;
  onClearSelection: () => void;
  // Camera focus request
  flyToTarget: { lng: number; lat: number; zoom?: number; pitch?: number } | null;
}

export const MapCanvas: React.FC<MapCanvasProps> = ({
  satellites,
  selectedSat,
  orbitSegments,
  earthquakes,
  selectedEarthquake,
  telemetry,
  selectedTelemetry,
  weatherIncidents,
  selectedIncident,
  terminatorData,
  showSatellites,
  showOrbits,
  showEarthquakes,
  showAviation,
  showMaritime,
  showTerminator,
  showIncidents,
  hasadParcels,
  selectedParcel,
  hasadSensors,
  selectedSensor,
  hasadRadar,
  showHasadSentinel,
  showHasadWeather,
  showHasadParcels,
  showHasadIoT,
  sentinelOpacity,
  radarOpacity,
  selectedDate,
  onSelectParcel,
  onSelectSensor,
  satCategoryFilter,
  minMagnitude,
  basemapKey,
  onSelectSatellite,
  onSelectEarthquake,
  onSelectTelemetry,
  onSelectIncident,
  onClearSelection,
  flyToTarget,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const overlayRef = useRef<MapboxOverlay | null>(null);
  const [pulsePhase, setPulsePhase] = useState(0);
  const [is3D, setIs3D] = useState(false);

  // Pulse animation ticker for shockwaves, radar loops & IoT irrigation pulses
  useEffect(() => {
    let animId: number;
    let start = performance.now();

    const loop = (now: number) => {
      const elapsed = (now - start) / 1000;
      setPulsePhase((elapsed % 1.5) / 1.5);
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Initialize MapLibre
  useEffect(() => {
    if (!mapContainerRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: (BASEMAP_STYLES[basemapKey]?.style as any) || BASEMAP_STYLES.cartoDark.style,
      center: [15, 20],
      zoom: 1.8,
      minZoom: 1,
      maxZoom: 18,
      pitch: 0,
      bearing: 0,
      attributionControl: false,
    });

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      getTooltip: (info: any) => {
        if (!info.object) return null;
        const obj = info.object;

        // 1. HASAD Field Parcel Tooltip
        if (obj.properties?.cropType) {
          return {
            html: `<div class="bg-slate-900/95 border border-emerald-500/50 p-2.5 text-xs rounded text-slate-100 shadow-xl font-mono">
              <div class="font-bold text-emerald-400">${obj.properties.name}</div>
              <div class="text-[10px] text-slate-400 uppercase">${obj.properties.cropType} &bull; ${obj.properties.areaHectares} ha</div>
              <div class="mt-1 text-[11px] flex items-center gap-2">
                <span>NDVI: <b class="text-emerald-300">${obj.properties.ndvi}</b></span>
                <span>Moisture: <b class="text-cyan-300">${obj.properties.soilMoisturePct}%</b></span>
              </div>
            </div>`,
            className: 'deck-tooltip',
          };
        }

        // 2. HASAD IoT Sensor Node Tooltip
        if (obj.nodeType) {
          return {
            html: `<div class="bg-slate-900/95 border border-cyan-500/50 p-2.5 text-xs rounded text-slate-100 shadow-xl font-mono">
              <div class="font-bold text-cyan-300">${obj.name}</div>
              <div class="text-[10px] text-slate-400 uppercase">${obj.nodeType.replace('_', ' ')} &bull; ${obj.batteryPct}% Batt</div>
              <div class="mt-1 text-[11px]">Root Moisture: ${obj.soilMoisture20cm}% | Valve: <span class="text-emerald-400 font-bold">${obj.valveState}</span></div>
            </div>`,
            className: 'deck-tooltip',
          };
        }

        // 3. Satellite Tooltip
        if (obj.name && obj.category) {
          return {
            html: `<div class="bg-slate-900/95 border border-cyan-500/40 p-2 text-xs rounded text-slate-100 shadow-xl font-mono">
              <div class="font-bold text-cyan-400">${obj.name}</div>
              <div class="text-[10px] text-slate-400 uppercase">${obj.category}</div>
              <div class="mt-1 text-[11px]">Alt: ${obj.altitudeKm || 0} km | Vel: ${obj.velocityKmS || 0} km/s</div>
            </div>`,
            className: 'deck-tooltip',
          };
        }

        // 4. Earthquake Tooltip
        if (obj.properties?.mag !== undefined) {
          return {
            html: `<div class="bg-slate-900/95 border border-red-500/40 p-2 text-xs rounded text-slate-100 shadow-xl font-mono">
              <div class="font-bold text-red-400">MAG ${obj.properties.mag} SEISMIC EVENT</div>
              <div class="text-[11px] text-slate-300">${obj.properties.place}</div>
              <div class="text-[10px] text-slate-400">Depth: ${obj.geometry.coordinates[2]} km</div>
            </div>`,
            className: 'deck-tooltip',
          };
        }

        // 5. Telemetry (Aviation / Maritime)
        if (obj.properties?.category === 'aviation' || obj.properties?.category === 'maritime') {
          return {
            html: `<div class="bg-slate-900/95 border border-sky-500/40 p-2 text-xs rounded text-slate-100 shadow-xl font-mono">
              <div class="font-bold text-sky-400">${obj.properties.callsign}</div>
              <div class="text-[10px] text-slate-400">${obj.properties.subType}</div>
              <div class="text-[11px]">Speed: ${obj.properties.speedKts} kts | Hdg: ${obj.properties.heading}°</div>
            </div>`,
            className: 'deck-tooltip',
          };
        }

        return null;
      },
    });

    map.addControl(overlay as any);

    map.on('error', (e) => {
      // Catch worker notices and non-fatal tile errors without breaking app
      console.warn('[MapLibre Event Notice]', e?.error?.message || e);
    });

    mapRef.current = map;
    overlayRef.current = overlay;

    return () => {
      overlay.finalize();
      map.remove();
      mapRef.current = null;
      overlayRef.current = null;
    };
  }, []);

  // Update Basemap style if changed
  useEffect(() => {
    if (!mapRef.current) return;
    try {
      const selectedStyle = (BASEMAP_STYLES[basemapKey]?.style as any) || BASEMAP_STYLES.cartoDark.style;
      mapRef.current.setStyle(selectedStyle);
    } catch (err) {
      console.warn('Basemap style switch err:', err);
    }
  }, [basemapKey]);

  // Camera Fly-to
  useEffect(() => {
    if (!flyToTarget || !mapRef.current) return;
    mapRef.current.flyTo({
      center: [flyToTarget.lng, flyToTarget.lat],
      zoom: flyToTarget.zoom ?? 5,
      pitch: flyToTarget.pitch ?? (is3D ? 45 : 0),
      speed: 1.4,
      curve: 1.42,
      essential: true,
    });
  }, [flyToTarget, is3D]);

  // Update Deck.gl Layers
  useEffect(() => {
    if (!overlayRef.current) return;

    const layers: any[] = [];

    // 1. Day / Night Solar Terminator
    if (showTerminator && terminatorData) {
      layers.push(...createDayNightLayer({ terminatorData, visible: showTerminator }));
    }

    // 2. HASAD Sentinel-2 NDVI Tile Layer (tiled imagery below vectors)
    if (showHasadSentinel) {
      layers.push(
        ...createHasadSentinelLayer({
          parcels: hasadParcels,
          selectedParcel,
          visible: showHasadSentinel,
          opacity: sentinelOpacity,
          selectedDate,
        })
      );
    }

    // 3. HASAD Weather Radar Tile Layer
    if (showHasadWeather) {
      layers.push(
        ...createHasadWeatherLayer({
          radarData: hasadRadar,
          visible: showHasadWeather,
          opacity: radarOpacity,
        })
      );
    }

    // 4. HASAD 3D Field Parcels (Extruded polygons)
    if (showHasadParcels) {
      layers.push(
        ...createHasadParcelsLayer({
          parcels: hasadParcels,
          selectedParcelId: selectedParcel?.id || null,
          visible: showHasadParcels,
          animationTick: pulsePhase,
          onSelectParcel,
        })
      );
    }

    // 5. HASAD Live IoT Sensor Telemetry Nodes
    if (showHasadIoT) {
      layers.push(
        ...createHasadIoTLayer({
          sensors: hasadSensors,
          selectedSensorId: selectedSensor?.id || null,
          visible: showHasadIoT,
          pulsePhase,
          onSelectSensor,
        })
      );
    }

    // 6. Earthquakes
    if (showEarthquakes) {
      layers.push(
        ...createEarthquakeLayers({
          features: earthquakes,
          selectedId: selectedEarthquake?.id || null,
          minMagnitude,
          pulsePhase,
          onSelectEarthquake,
        })
      );
    }

    // 7. Telemetry (Aviation & Maritime)
    if (showAviation || showMaritime) {
      layers.push(
        ...createTelemetryLayers({
          features: telemetry,
          selectedId: selectedTelemetry?.properties.id || null,
          showAviation,
          showMaritime,
          onSelectTelemetry,
        })
      );
    }

    // 8. OSINT Weather Incidents / Storms
    if (showIncidents) {
      layers.push(
        ...createIncidentLayers({
          incidents: weatherIncidents,
          selectedId: selectedIncident?.id || null,
          visible: showIncidents,
          pulsePhase,
          onSelectIncident,
        })
      );
    }

    // 9. Active Satellites & Orbital Paths
    if (showSatellites) {
      layers.push(
        ...createSatelliteLayers({
          satellites,
          selectedSatId: selectedSat?.id || null,
          orbitSegments,
          onSelectSatellite,
          showOrbits,
          filterCategory: satCategoryFilter,
        })
      );
    }

    overlayRef.current.setProps({ layers });
  }, [
    satellites,
    selectedSat,
    orbitSegments,
    earthquakes,
    selectedEarthquake,
    telemetry,
    selectedTelemetry,
    weatherIncidents,
    selectedIncident,
    terminatorData,
    showSatellites,
    showOrbits,
    showEarthquakes,
    showAviation,
    showMaritime,
    showTerminator,
    showIncidents,
    hasadParcels,
    selectedParcel,
    hasadSensors,
    selectedSensor,
    hasadRadar,
    showHasadSentinel,
    showHasadWeather,
    showHasadParcels,
    showHasadIoT,
    sentinelOpacity,
    radarOpacity,
    selectedDate,
    satCategoryFilter,
    minMagnitude,
    pulsePhase,
    onSelectSatellite,
    onSelectEarthquake,
    onSelectTelemetry,
    onSelectIncident,
    onSelectParcel,
    onSelectSensor,
  ]);

  const toggle3D = useCallback(() => {
    if (!mapRef.current) return;
    const targetPitch = is3D ? 0 : 55;
    mapRef.current.easeTo({ pitch: targetPitch, duration: 800 });
    setIs3D(!is3D);
  }, [is3D]);

  const resetBearing = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.easeTo({ bearing: 0, pitch: 0, duration: 600 });
    setIs3D(false);
  }, []);

  const resetView = useCallback(() => {
    if (!mapRef.current) return;
    mapRef.current.flyTo({ center: [15, 20], zoom: 1.8, pitch: 0, bearing: 0, speed: 1.2 });
    setIs3D(false);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden bg-[#05080f]">
      {/* MapLibre DOM Node */}
      <div ref={mapContainerRef} className="w-full h-full outline-none" />

      {/* Crosshair / Scanline Overlay (Aesthetic OSINT overlay) */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,24,38,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]" />

      {/* Floating Tactical Map Controls */}
      <div className="absolute right-4 bottom-8 flex flex-col gap-1.5 z-20">
        <button
          onClick={() => mapRef.current?.zoomIn()}
          title="Zoom In"
          className="w-9 h-9 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center font-mono font-bold text-lg shadow-lg transition-all"
        >
          +
        </button>
        <button
          onClick={() => mapRef.current?.zoomOut()}
          title="Zoom Out"
          className="w-9 h-9 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-200 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center font-mono font-bold text-lg shadow-lg transition-all"
        >
          −
        </button>
        <button
          onClick={toggle3D}
          title="Toggle 3D Perspective Tilt"
          className={`w-9 h-9 rounded backdrop-blur-md border flex items-center justify-center font-mono text-xs font-bold shadow-lg transition-all ${
            is3D
              ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-cyan-500/20'
              : 'bg-slate-900/80 border-slate-700/60 text-slate-300 hover:border-cyan-500/50'
          }`}
        >
          3D
        </button>
        <button
          onClick={resetBearing}
          title="Reset Heading to North"
          className="w-9 h-9 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center font-mono text-[11px] font-semibold shadow-lg transition-all"
        >
          N
        </button>
        <button
          onClick={resetView}
          title="Global Overview"
          className="w-9 h-9 rounded bg-slate-900/80 backdrop-blur-md border border-slate-700/60 text-slate-300 hover:text-cyan-400 hover:border-cyan-500/50 flex items-center justify-center font-mono text-xs shadow-lg transition-all"
        >
          🌐
        </button>
      </div>

      {/* Coordinates / Viewport Telemetry HUD at bottom-left */}
      <div className="absolute left-4 bottom-3 z-20 pointer-events-none flex items-center gap-3 font-mono text-[11px] text-slate-400/90 bg-slate-950/80 px-2.5 py-1 rounded border border-slate-800/80 backdrop-blur-sm">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>GPU WEBGL ENGINE</span>
        </span>
        <span className="text-slate-600">|</span>
        <span>PROJECTION: MERCATOR 4326/3857</span>
        <span className="text-slate-600">|</span>
        <span className="text-emerald-400/90">HASAD AGRI-TECH v2.4</span>
      </div>
    </div>
  );
};
