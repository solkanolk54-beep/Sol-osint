import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MapCanvas, BASEMAP_STYLES } from './components/MapCanvas.tsx';
import { HeaderHUD } from './components/HeaderHUD.tsx';
import { ControlPanel } from './components/ControlPanel.tsx';
import { HasadControls } from './components/HasadControls.tsx';
import { EntityInspector } from './components/EntityInspector.tsx';
import { IncidentsFeed } from './components/IncidentsFeed.tsx';
import { AlertBanner } from './components/AlertBanner.tsx';
import { IrrigationAlertBanner } from './components/IrrigationAlertBanner.tsx';

import {
  getSatellitePosition,
  computeOrbitPath,
  type CalculatedSatellitePosition,
  type OrbitPathSegment,
} from './utils/satelliteMath.ts';
import { soundEngine } from './utils/audioAlerts.ts';
import * as satellite from 'satellite.js';
import type { ParcelStressAlert, ValveActuationRecord } from './types/irrigation.ts';

import type {
  SatelliteMetadata,
  EarthquakeFeature,
  EarthquakeFeed,
  TelemetryFeature,
  TelemetryFeed,
  GeoJsonPolygon,
  WeatherIncident,
} from './types/telemetry.ts';

import type {
  FieldParcelCollection,
  FieldParcelFeature,
  IoTSensorNode,
  RainViewerData,
  HasadAgriHub,
} from './types/hasad.ts';

export default function App() {
  // Telemetry raw states
  const [rawSatellites, setRawSatellites] = useState<SatelliteMetadata[]>([]);
  const [earthquakes, setEarthquakes] = useState<EarthquakeFeature[]>([]);
  const [telemetry, setTelemetry] = useState<TelemetryFeature[]>([]);
  const [weatherIncidents, setWeatherIncidents] = useState<WeatherIncident[]>([]);
  const [terminatorData, setTerminatorData] = useState<GeoJsonPolygon | null>(null);

  // HASAD AgriTech Engine states
  const [hasadParcels, setHasadParcels] = useState<FieldParcelCollection | null>(null);
  const [hasadSensors, setHasadSensors] = useState<IoTSensorNode[]>([]);
  const [hasadRadar, setHasadRadar] = useState<RainViewerData | null>(null);
  const [hasadHubs, setHasadHubs] = useState<HasadAgriHub[]>([]);
  const [activeHubId, setActiveHubId] = useState<string>('hub-alkharj');
  const [showHasadSentinel, setShowHasadSentinel] = useState(true);
  const [showHasadWeather, setShowHasadWeather] = useState(true);
  const [showHasadParcels, setShowHasadParcels] = useState(true);
  const [showHasadIoT, setShowHasadIoT] = useState(true);
  const [sentinelOpacity, setSentinelOpacity] = useState(0.70);
  const [radarOpacity, setRadarOpacity] = useState(0.55);
  const [selectedDate, setSelectedDate] = useState('2026-10-02');
  const [isHasadOpen, setIsHasadOpen] = useState(false);
  const [selectedParcel, setSelectedParcel] = useState<FieldParcelFeature | null>(null);
  const [selectedSensor, setSelectedSensor] = useState<IoTSensorNode | null>(null);

  // SSE Stream Status & Cache Status
  const [streamStatus, setStreamStatus] = useState<'connected' | 'connecting' | 'disconnected'>('connecting');
  const [cacheMode, setCacheMode] = useState('MEMORY');

  // Layer switches
  const [showSatellites, setShowSatellites] = useState(true);
  const [showOrbits, setShowOrbits] = useState(true);
  const [showEarthquakes, setShowEarthquakes] = useState(true);
  const [showAviation, setShowAviation] = useState(true);
  const [showMaritime, setShowMaritime] = useState(true);
  const [showTerminator, setShowTerminator] = useState(true);
  const [showIncidents, setShowIncidents] = useState(true);

  // Filters & Cartography
  const [satCategoryFilter, setSatCategoryFilter] = useState('ALL');
  const [minMagnitude, setMinMagnitude] = useState(2.0);
  const [basemapKey, setBasemapKey] = useState<keyof typeof BASEMAP_STYLES>('cartoDark');

  // UI Drawers & Audio
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isFeedOpen, setIsFeedOpen] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // Selections
  const [selectedSat, setSelectedSat] = useState<CalculatedSatellitePosition | null>(null);
  const [selectedEarthquake, setSelectedEarthquake] = useState<EarthquakeFeature | null>(null);
  const [selectedTelemetry, setSelectedTelemetry] = useState<TelemetryFeature | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<WeatherIncident | null>(null);

  // Alerts & Prescriptive Hydration Engine
  const [priorityAlert, setPriorityAlert] = useState<EarthquakeFeature | null>(null);
  const [hydrationAlerts, setHydrationAlerts] = useState<ParcelStressAlert[]>([]);
  const activeStressAlert = useMemo(() => {
    return hydrationAlerts.find((a) => !a.dismissed) || null;
  }, [hydrationAlerts]);

  // Camera Target
  const [flyToTarget, setFlyToTarget] = useState<{ lng: number; lat: number; zoom?: number; pitch?: number } | null>(null);

  // Clock tick for SGP4 real-time propagation (updates every 1000ms)
  const [simTime, setSimTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setSimTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Web Worker for background satellite SGP4 propagation (off main thread)
  const [workerSatellites, setWorkerSatellites] = useState<CalculatedSatellitePosition[]>([]);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    try {
      const worker = new Worker(new URL('./workers/satelliteWorker.ts', import.meta.url), {
        type: 'module',
      });
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const positions = e.data;
        if (Array.isArray(positions)) {
          setWorkerSatellites(
            positions.map((p: any) => ({
              id: p.id,
              name: p.name,
              category: p.category,
              longitude: p.lng,
              latitude: p.lat,
              altitudeKm: p.alt,
              velocityKmS: p.velocityKmS,
              line1: '',
              line2: '',
              inclination: p.inclination,
              periodMinutes: p.periodMinutes,
            }))
          );
        }
      };

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch (err) {
      console.warn('[App] Web Worker not supported in this environment, using main thread');
    }
  }, []);

  // Post records to worker on rawSatellites change or simTime tick
  useEffect(() => {
    if (workerRef.current && showSatellites && rawSatellites.length > 0) {
      workerRef.current.postMessage({
        satRecords: rawSatellites,
        timestamp: simTime.getTime(),
      });
    }
  }, [rawSatellites, simTime, showSatellites]);

  // Instantaneous SGP4 positions for all satellites
  const calculatedSatellites = useMemo(() => {
    if (!showSatellites || rawSatellites.length === 0) return [];
    if (workerSatellites.length > 0) return workerSatellites;
    const results: CalculatedSatellitePosition[] = [];
    for (const raw of rawSatellites) {
      const pos = getSatellitePosition(raw, simTime);
      if (pos) {
        results.push(pos);
      }
    }
    return results;
  }, [rawSatellites, simTime, showSatellites, workerSatellites]);

  // Keep selected satellite position up-to-date
  useEffect(() => {
    if (selectedSat) {
      const updated = calculatedSatellites.find((s) => s.id === selectedSat.id);
      if (updated) {
        setSelectedSat(updated);
      }
    }
  }, [calculatedSatellites, selectedSat?.id]);

  // Compute Projected Orbital Paths (for selected satellite and prominent stations like ISS, CSS)
  const orbitSegments = useMemo(() => {
    if (!showOrbits || (calculatedSatellites.length === 0 && rawSatellites.length === 0)) return [];
    const segments: OrbitPathSegment[] = [];

    // Target satellites for orbit rendering:
    if (selectedSat) {
      const raw = rawSatellites.find((r) => r.id === selectedSat.id);
      if (raw) {
        try {
          const satrec = selectedSat.satrec || satellite.twoline2satrec(raw.line1, raw.line2);
          segments.push(...computeOrbitPath(satrec, selectedSat.name, selectedSat.id, simTime, 120, 1.5));
        } catch {}
      }
    }

    // Prominent space stations
    const prominentIds = [25544, 48274];
    for (const pid of prominentIds) {
      if (selectedSat?.id === pid) continue;
      const raw = rawSatellites.find((r) => r.id === pid);
      if (raw) {
        try {
          const satrec = satellite.twoline2satrec(raw.line1, raw.line2);
          segments.push(...computeOrbitPath(satrec, raw.name, raw.id, simTime, 95, 2));
        } catch {}
      }
    }

    return segments;
  }, [calculatedSatellites, rawSatellites, selectedSat, showOrbits, simTime]);

  // Initial REST fetch fallback
  const fetchInitialData = useCallback(async () => {
    try {
      const [satsRes, eqRes, telRes, termRes, parcelsRes, sensorsRes, radarRes, hubsRes, alertsRes] =
        await Promise.allSettled([
          fetch('/api/satellites').then((r) => r.json()),
          fetch('/api/earthquakes').then((r) => r.json()),
          fetch('/api/telemetry').then((r) => r.json()),
          fetch('/api/geo/sun-terminator').then((r) => r.json()),
          fetch('/api/hasad/parcels').then((r) => r.json()),
          fetch('/api/hasad/sensors').then((r) => r.json()),
          fetch('/api/hasad/weather-radar').then((r) => r.json()),
          fetch('/api/hasad/hubs').then((r) => r.json()),
          fetch('/api/hasad/hydration-alerts').then((r) => r.json()),
        ]);

      if (satsRes.status === 'fulfilled' && satsRes.value.data) {
        setRawSatellites(satsRes.value.data);
      }
      if (eqRes.status === 'fulfilled' && eqRes.value.features) {
        setEarthquakes(eqRes.value.features);
      }
      if (telRes.status === 'fulfilled' && telRes.value.features) {
        setTelemetry(telRes.value.features);
      }
      if (termRes.status === 'fulfilled' && termRes.value.type === 'Feature') {
        setTerminatorData(termRes.value);
      }
      if (parcelsRes.status === 'fulfilled' && parcelsRes.value.type === 'FeatureCollection') {
        setHasadParcels(parcelsRes.value);
      }
      if (sensorsRes.status === 'fulfilled' && Array.isArray(sensorsRes.value)) {
        setHasadSensors(sensorsRes.value);
      }
      if (radarRes.status === 'fulfilled' && radarRes.value.radar) {
        setHasadRadar(radarRes.value);
      }
      if (hubsRes.status === 'fulfilled' && Array.isArray(hubsRes.value)) {
        setHasadHubs(hubsRes.value);
      }
      if (alertsRes.status === 'fulfilled' && Array.isArray(alertsRes.value?.alerts)) {
        setHydrationAlerts(alertsRes.value.alerts);
      }

      // Check health
      fetch('/api/health')
        .then((r) => r.json())
        .then((d) => {
          if (d.redis) setCacheMode(d.redis);
        })
        .catch(() => {});
    } catch (err) {
      console.warn('Initial telemetry fetch error:', err);
    }
  }, []);

  // Weather radar periodic auto-refresh (every 5 minutes per spec)
  useEffect(() => {
    const radarInterval = setInterval(() => {
      fetch('/api/hasad/weather-radar')
        .then((r) => r.json())
        .then((data) => {
          if (data && data.radar) {
            setHasadRadar(data);
          }
        })
        .catch(() => {});
    }, 5 * 60 * 1000);

    return () => clearInterval(radarInterval);
  }, []);

  // Server-Sent Events (SSE) Live Stream Subscription
  useEffect(() => {
    fetchInitialData();

    let eventSource: EventSource | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectSSE = () => {
      setStreamStatus('connecting');
      eventSource = new EventSource('/api/stream/all');

      eventSource.onopen = () => {
        setStreamStatus('connected');
        console.log('[App] SSE Telemetry Stream established');
      };

      eventSource.addEventListener('connected', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          console.log('[SSE Handshake]', data.message);
        } catch {}
      });

      eventSource.addEventListener('satellites_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.items)) {
            setRawSatellites(data.items);
          }
        } catch {}
      });

      eventSource.addEventListener('satellite_refresh', (e: MessageEvent) => {
        fetch('/api/satellites')
          .then((r) => r.json())
          .then((d) => d.data && setRawSatellites(d.data))
          .catch(() => {});
      });

      eventSource.addEventListener('earthquakes_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as EarthquakeFeed;
          if (Array.isArray(data.features)) {
            setEarthquakes(data.features);
            const critical = data.features.find((f) => f.properties.mag >= 5.5);
            if (critical) {
              setPriorityAlert(critical);
              soundEngine.playWarningChirp();
            }
          }
        } catch {}
      });

      eventSource.addEventListener('earthquake_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (Array.isArray(data.items)) {
            setEarthquakes((prev) => [...data.items, ...prev].slice(0, 100));
            const severe = data.items.find((f: EarthquakeFeature) => f.properties.mag >= 5.0);
            if (severe) {
              setPriorityAlert(severe);
              soundEngine.playWarningChirp();
            }
          }
        } catch {}
      });

      eventSource.addEventListener('telemetry_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as TelemetryFeed;
          if (Array.isArray(data.features)) {
            setTelemetry(data.features);
          }
        } catch {}
      });

      eventSource.addEventListener('telemetry_batch', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as TelemetryFeed;
          if (Array.isArray(data.features)) {
            setTelemetry(data.features);
          }
        } catch {}
      });

      eventSource.addEventListener('weather_incidents', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as WeatherIncident[];
          if (Array.isArray(data)) {
            setWeatherIncidents(data);
          }
        } catch {}
      });

      eventSource.addEventListener('terminator_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as GeoJsonPolygon;
          setTerminatorData(data);
        } catch {}
      });

      eventSource.addEventListener('terminator_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as GeoJsonPolygon;
          setTerminatorData(data);
        } catch {}
      });

      // HASAD Events
      eventSource.addEventListener('hasad_parcels_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as FieldParcelCollection;
          if (data && data.features) {
            setHasadParcels(data);
          }
        } catch {}
      });

      eventSource.addEventListener('hasad_sensors_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as IoTSensorNode[];
          if (Array.isArray(data)) {
            setHasadSensors(data);
          }
        } catch {}
      });

      eventSource.addEventListener('hasad_sensors_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as IoTSensorNode[];
          if (Array.isArray(data)) {
            setHasadSensors(data);
          }
        } catch {}
      });

      eventSource.addEventListener('hasad_parcels_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as FieldParcelCollection;
          if (data && data.features) {
            setHasadParcels(data);
          }
        } catch {}
      });

      eventSource.addEventListener('hydration_alerts_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as ParcelStressAlert[];
          if (Array.isArray(data)) {
            setHydrationAlerts(data);
          }
        } catch {}
      });

      eventSource.addEventListener('hydration_alerts_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as ParcelStressAlert[];
          if (Array.isArray(data)) {
            setHydrationAlerts(data);
          }
        } catch {}
      });

      eventSource.addEventListener('irrigation_actuation', (e: MessageEvent) => {
        try {
          const record = JSON.parse(e.data) as ValveActuationRecord;
          if (record && record.parcelId) {
            soundEngine.playRadarPing();
          }
        } catch {}
      });

      eventSource.addEventListener('hasad_radar_init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data) as RainViewerData;
          if (data && data.radar) {
            setHasadRadar(data);
          }
        } catch {}
      });

      eventSource.addEventListener('ping', () => {
        setStreamStatus('connected');
      });

      eventSource.onerror = () => {
        setStreamStatus('disconnected');
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 4000);
      };
    };

    connectSSE();

    return () => {
      if (eventSource) eventSource.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [fetchInitialData]);

  // Selection handlers
  const handleSelectSatellite = useCallback((sat: CalculatedSatellitePosition) => {
    setSelectedSat(sat);
    setSelectedEarthquake(null);
    setSelectedTelemetry(null);
    setSelectedIncident(null);
    setSelectedParcel(null);
    setSelectedSensor(null);
    soundEngine.playRadarPing();
  }, []);

  const handleSelectEarthquake = useCallback((eq: EarthquakeFeature) => {
    setSelectedEarthquake(eq);
    setSelectedSat(null);
    setSelectedTelemetry(null);
    setSelectedIncident(null);
    setSelectedParcel(null);
    setSelectedSensor(null);
    soundEngine.playRadarPing();
  }, []);

  const handleSelectTelemetry = useCallback((t: TelemetryFeature) => {
    setSelectedTelemetry(t);
    setSelectedSat(null);
    setSelectedEarthquake(null);
    setSelectedIncident(null);
    setSelectedParcel(null);
    setSelectedSensor(null);
    soundEngine.playRadarPing();
  }, []);

  const handleSelectIncident = useCallback((inc: WeatherIncident) => {
    setSelectedIncident(inc);
    setSelectedSat(null);
    setSelectedEarthquake(null);
    setSelectedTelemetry(null);
    setSelectedParcel(null);
    setSelectedSensor(null);
    soundEngine.playRadarPing();
  }, []);

  const handleSelectParcel = useCallback((parcel: FieldParcelFeature) => {
    setSelectedParcel(parcel);
    setSelectedSensor(null);
    setSelectedSat(null);
    setSelectedEarthquake(null);
    setSelectedTelemetry(null);
    setSelectedIncident(null);
    soundEngine.playRadarPing();
  }, []);

  const handleSelectSensor = useCallback((sensor: IoTSensorNode) => {
    setSelectedSensor(sensor);
    setSelectedParcel(null);
    setSelectedSat(null);
    setSelectedEarthquake(null);
    setSelectedTelemetry(null);
    setSelectedIncident(null);
    soundEngine.playRadarPing();
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedSat(null);
    setSelectedEarthquake(null);
    setSelectedTelemetry(null);
    setSelectedIncident(null);
    setSelectedParcel(null);
    setSelectedSensor(null);
  }, []);

  const handleFocusCoordinates = useCallback((lng: number, lat: number, zoom = 5) => {
    setFlyToTarget({ lng, lat, zoom });
  }, []);

  const handleSelectHub = useCallback((hub: HasadAgriHub) => {
    setActiveHubId(hub.id);
    setFlyToTarget({
      lng: hub.coordinates[0],
      lat: hub.coordinates[1],
      zoom: hub.zoom,
      pitch: hub.pitch,
    });
  }, []);

  const handleToggleValve = useCallback((sensorId: string) => {
    setHasadSensors((prev) =>
      prev.map((s) => {
        if (s.id === sensorId) {
          const nextState = s.valveState === 'open' || s.valveState === 'flow_pulsing' ? 'closed' : 'flow_pulsing';
          return {
            ...s,
            valveState: nextState,
            flowRateLpm: nextState === 'closed' ? 0 : 165.0,
          };
        }
        return s;
      })
    );
    if (selectedSensor?.id === sensorId) {
      setSelectedSensor((prev) =>
        prev
          ? {
              ...prev,
              valveState: prev.valveState === 'open' || prev.valveState === 'flow_pulsing' ? 'closed' : 'flow_pulsing',
              flowRateLpm: prev.valveState === 'closed' ? 165.0 : 0,
            }
          : null
      );
    }
  }, [selectedSensor?.id]);

  const handleTriggerGlobalIrrigation = useCallback(() => {
    setHasadSensors((prev) =>
      prev.map((s) => ({
        ...s,
        valveState: 'flow_pulsing',
        flowRateLpm: 155.0,
        soilMoisture20cm: parseFloat((s.soilMoisture20cm + 3.5).toFixed(1)),
      }))
    );
  }, []);

  // One-click Solenoid Valve Actuation Engine
  const handleActuateValve = useCallback(
    async (parcelId: string, valveId?: string, action: 'OPEN' | 'CLOSE' = 'OPEN', durationMinutes = 30) => {
      try {
        const res = await fetch('/api/hasad/actuate-valve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ parcelId, valveId, action, durationMinutes }),
        });
        const data = await res.json();
        if (data.success) {
          // Optimistic local state update
          setHasadParcels((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              features: prev.features.map((f) => {
                if (f.id === parcelId) {
                  return {
                    ...f,
                    properties: {
                      ...f.properties,
                      irrigationStatus: action === 'OPEN' ? 'active' : 'idle',
                      soilMoisturePct: action === 'OPEN' ? parseFloat((f.properties.soilMoisturePct + 3.0).toFixed(1)) : f.properties.soilMoisturePct,
                      recommendedAction: action === 'OPEN' ? `Automated solenoid cycle ACTIVE (${durationMinutes}m pulse). Hydraulic recovery underway.` : 'Irrigation completed.',
                    },
                  };
                }
                return f;
              }),
            };
          });

          setHasadSensors((prev) =>
            prev.map((s) => {
              if (s.parcelId === parcelId) {
                return {
                  ...s,
                  valveState: action === 'OPEN' ? 'flow_pulsing' : 'closed',
                  flowRateLpm: action === 'OPEN' ? 175.0 : 0,
                  soilMoisture20cm: action === 'OPEN' ? parseFloat((s.soilMoisture20cm + 3.0).toFixed(1)) : s.soilMoisture20cm,
                  alertActive: false,
                };
              }
              return s;
            })
          );

          if (selectedParcel?.id === parcelId) {
            setSelectedParcel((prev) =>
              prev
                ? {
                    ...prev,
                    properties: {
                      ...prev.properties,
                      irrigationStatus: action === 'OPEN' ? 'active' : 'idle',
                      soilMoisturePct: action === 'OPEN' ? parseFloat((prev.properties.soilMoisturePct + 3.0).toFixed(1)) : prev.properties.soilMoisturePct,
                    },
                  }
                : null
            );
          }

          // Clear stress alert for this parcel
          setHydrationAlerts((prev) => prev.filter((a) => a.parcelId !== parcelId));
        }
      } catch (err) {
        console.error('Actuation request failed:', err);
      }
    },
    [selectedParcel?.id]
  );

  const handleDismissHydrationAlert = useCallback((alertId: string) => {
    setHydrationAlerts((prev) => prev.filter((a) => a.id !== alertId));
    fetch('/api/hasad/dismiss-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alertId }),
    }).catch(() => {});
  }, []);

  const handleActuateFromBanner = useCallback(
    (alert: ParcelStressAlert) => {
      // 1. Smooth camera flight targeting stressed parcel
      setFlyToTarget({
        lng: alert.coordinates[0],
        lat: alert.coordinates[1],
        zoom: 14.5,
        pitch: 52,
      });

      // 2. Target parcel in inspector
      const targetParcel = hasadParcels?.features.find((f) => f.id === alert.parcelId);
      if (targetParcel) {
        setSelectedParcel(targetParcel);
        setSelectedSensor(null);
      }

      // 3. Trigger immediate solenoid actuation with prescribed 30m pulse
      handleActuateValve(alert.parcelId, alert.defaultValveId, 'OPEN', 30);
    },
    [hasadParcels, handleActuateValve]
  );

  // Counts for HUD
  const aviationCount = useMemo(
    () => telemetry.filter((t) => t.properties.category === 'aviation').length,
    [telemetry]
  );
  const maritimeCount = useMemo(
    () => telemetry.filter((t) => t.properties.category === 'maritime').length,
    [telemetry]
  );

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#05080f] select-none font-sans">
      {/* Top Header HUD */}
      <HeaderHUD
        streamStatus={streamStatus}
        satelliteCount={calculatedSatellites.length}
        aviationCount={aviationCount}
        maritimeCount={maritimeCount}
        earthquakeCount={earthquakes.length}
        showSatellites={showSatellites}
        setShowSatellites={setShowSatellites}
        showAviation={showAviation}
        setShowAviation={setShowAviation}
        showMaritime={showMaritime}
        setShowMaritime={setShowMaritime}
        showEarthquakes={showEarthquakes}
        setShowEarthquakes={setShowEarthquakes}
        showTerminator={showTerminator}
        setShowTerminator={setShowTerminator}
        isSidebarOpen={isSidebarOpen}
        setIsSidebarOpen={setIsSidebarOpen}
        isFeedOpen={isFeedOpen}
        setIsFeedOpen={setIsFeedOpen}
        isHasadOpen={isHasadOpen}
        setIsHasadOpen={setIsHasadOpen}
        hasadParcelsCount={hasadParcels?.features.length || 0}
        audioEnabled={audioEnabled}
        setAudioEnabled={setAudioEnabled}
      />

      {/* Priority Tactical Alert Banner (Seismic / Incident) */}
      <AlertBanner
        alertEvent={priorityAlert}
        onDismiss={() => setPriorityAlert(null)}
        onLocate={(eq) => {
          handleSelectEarthquake(eq);
          handleFocusCoordinates(eq.geometry.coordinates[0], eq.geometry.coordinates[1], 6);
          setPriorityAlert(null);
        }}
      />

      {/* Predictive Yield & Automatic Irrigation Trigger Banner */}
      <IrrigationAlertBanner
        alert={activeStressAlert}
        onActuateNow={handleActuateFromBanner}
        onDismiss={handleDismissHydrationAlert}
        onLocateParcel={(lng, lat) => handleFocusCoordinates(lng, lat, 14.5)}
      />

      {/* MapLibre + Deck.gl GPU Canvas */}
      <main className="absolute inset-0 pt-14">
        <MapCanvas
          satellites={calculatedSatellites}
          selectedSat={selectedSat}
          orbitSegments={orbitSegments}
          earthquakes={earthquakes}
          selectedEarthquake={selectedEarthquake}
          telemetry={telemetry}
          selectedTelemetry={selectedTelemetry}
          weatherIncidents={weatherIncidents}
          selectedIncident={selectedIncident}
          terminatorData={terminatorData}
          showSatellites={showSatellites}
          showOrbits={showOrbits}
          showEarthquakes={showEarthquakes}
          showAviation={showAviation}
          showMaritime={showMaritime}
          showTerminator={showTerminator}
          showIncidents={showIncidents}
          hasadParcels={hasadParcels}
          selectedParcel={selectedParcel}
          hasadSensors={hasadSensors}
          selectedSensor={selectedSensor}
          hasadRadar={hasadRadar}
          showHasadSentinel={showHasadSentinel}
          showHasadWeather={showHasadWeather}
          showHasadParcels={showHasadParcels}
          showHasadIoT={showHasadIoT}
          sentinelOpacity={sentinelOpacity}
          radarOpacity={radarOpacity}
          selectedDate={selectedDate}
          onSelectParcel={handleSelectParcel}
          onSelectSensor={handleSelectSensor}
          satCategoryFilter={satCategoryFilter}
          minMagnitude={minMagnitude}
          basemapKey={basemapKey}
          onSelectSatellite={handleSelectSatellite}
          onSelectEarthquake={handleSelectEarthquake}
          onSelectTelemetry={handleSelectTelemetry}
          onSelectIncident={handleSelectIncident}
          onClearSelection={handleClearSelection}
          flyToTarget={flyToTarget}
        />
      </main>

      {/* Left Telemetry Control Panel Drawer */}
      <ControlPanel
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        showSatellites={showSatellites}
        setShowSatellites={setShowSatellites}
        showOrbits={showOrbits}
        setShowOrbits={setShowOrbits}
        showEarthquakes={showEarthquakes}
        setShowEarthquakes={setShowEarthquakes}
        showAviation={showAviation}
        setShowAviation={setShowAviation}
        showMaritime={showMaritime}
        setShowMaritime={setShowMaritime}
        showTerminator={showTerminator}
        setShowTerminator={setShowTerminator}
        showIncidents={showIncidents}
        setShowIncidents={setShowIncidents}
        satCategoryFilter={satCategoryFilter}
        setSatCategoryFilter={setSatCategoryFilter}
        minMagnitude={minMagnitude}
        setMinMagnitude={setMinMagnitude}
        basemapKey={basemapKey}
        setBasemapKey={setBasemapKey}
        counts={{
          satellites: calculatedSatellites.length,
          earthquakes: earthquakes.length,
          aviation: aviationCount,
          maritime: maritimeCount,
          incidents: weatherIncidents.length,
        }}
        cacheMode={cacheMode}
      />

      {/* HASAD AgriTech Engine Control Drawer */}
      <HasadControls
        isOpen={isHasadOpen}
        onClose={() => setIsHasadOpen(false)}
        showSentinel={showHasadSentinel}
        setShowSentinel={setShowHasadSentinel}
        showRadar={showHasadWeather}
        setShowRadar={setShowHasadWeather}
        showParcels={showHasadParcels}
        setShowParcels={setShowHasadParcels}
        showIoT={showHasadIoT}
        setShowIoT={setShowHasadIoT}
        sentinelOpacity={sentinelOpacity}
        setSentinelOpacity={setSentinelOpacity}
        radarOpacity={radarOpacity}
        setRadarOpacity={setRadarOpacity}
        selectedDate={selectedDate}
        setSelectedDate={setSelectedDate}
        hubs={hasadHubs}
        activeHubId={activeHubId}
        onSelectHub={handleSelectHub}
        parcels={hasadParcels}
        sensors={hasadSensors}
        onTriggerGlobalIrrigation={handleTriggerGlobalIrrigation}
      />

      {/* Right Incident & Event Feed Drawer */}
      <IncidentsFeed
        isOpen={isFeedOpen}
        onClose={() => setIsFeedOpen(false)}
        earthquakes={earthquakes}
        weatherIncidents={weatherIncidents}
        satellites={calculatedSatellites}
        onSelectEarthquake={handleSelectEarthquake}
        onSelectWeather={handleSelectIncident}
        onSelectSatellite={handleSelectSatellite}
        onFocus={handleFocusCoordinates}
      />

      {/* Bottom Entity Telemetry Inspector (Satellites, Earthquakes, Traffic, Field Parcels & IoT Probes) */}
      <EntityInspector
        selectedSat={selectedSat}
        selectedEarthquake={selectedEarthquake}
        selectedTelemetry={selectedTelemetry}
        selectedIncident={selectedIncident}
        selectedParcel={selectedParcel}
        selectedSensor={selectedSensor}
        onClose={handleClearSelection}
        onFocusCoordinates={handleFocusCoordinates}
        onToggleValve={handleToggleValve}
        onActuateValve={handleActuateValve}
      />
    </div>
  );
}
