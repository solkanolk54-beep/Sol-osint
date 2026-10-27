import { cache } from '../redisClient.ts';
import type {
  FieldParcelCollection,
  FieldParcelFeature,
  IoTSensorNode,
  RainViewerData,
  HasadAgriHub,
} from '../../src/types/hasad.ts';

const REDIS_RAINVIEWER_KEY = 'hasad:weather:rainviewer';
const CACHE_TTL_SECONDS = 300; // 5 minutes

export const HASAD_HUBS: HasadAgriHub[] = [
  {
    id: 'hub-alkharj',
    name: 'Al-Kharj Center-Pivot Agri Basin',
    country: 'Saudi Arabia',
    coordinates: [47.285, 24.135],
    zoom: 13.2,
    pitch: 52,
    hectares: 3840,
    cropTypes: ['Alfalfa', 'Wheat', 'Date Palms', 'Forage Maize'],
  },
  {
    id: 'hub-sanjoaquin',
    name: 'San Joaquin Precision Ag Sector',
    country: 'United States',
    coordinates: [-119.82, 36.75],
    zoom: 13.5,
    pitch: 48,
    hectares: 2950,
    cropTypes: ['Almonds', 'Wine Vineyards', 'Citrus Orchards'],
  },
  {
    id: 'hub-guadalquivir',
    name: 'Guadalquivir Smart Valley',
    country: 'Spain',
    coordinates: [-5.84, 37.41],
    zoom: 13.4,
    pitch: 45,
    hectares: 2100,
    cropTypes: ['Super-High-Density Olives', 'Oranges', 'Cotton'],
  },
  {
    id: 'hub-toshka',
    name: 'Toshka Desert Oasis Reclamation',
    country: 'Egypt',
    coordinates: [31.55, 22.68],
    zoom: 13.0,
    pitch: 50,
    hectares: 4500,
    cropTypes: ['Wheat', 'Durum', 'Barley', 'Medicinal Herbs'],
  },
];

// Helper to generate polygon circle points for center-pivot irrigation circles
function createPivotCircle(
  centerLng: number,
  centerLat: number,
  radiusKm = 0.55,
  points = 32
): number[][] {
  const coords: number[][] = [];
  const kmToLng = 1 / (111.32 * Math.cos((centerLat * Math.PI) / 180));
  const kmToLat = 1 / 110.574;

  for (let i = 0; i < points; i++) {
    const angle = (i * 2 * Math.PI) / points;
    const lng = centerLng + Math.cos(angle) * radiusKm * kmToLng;
    const lat = centerLat + Math.sin(angle) * radiusKm * kmToLat;
    coords.push([parseFloat(lng.toFixed(6)), parseFloat(lat.toFixed(6))]);
  }
  coords.push(coords[0]); // Close ring
  return coords;
}

// Generate realistic parcel features for the primary hubs
function generateBaselineParcels(): FieldParcelFeature[] {
  const features: FieldParcelFeature[] = [];

  // Hub 1: Al-Kharj Center Pivots (Saudi Arabia)
  const alkharjPivots = [
    {
      id: 'SA-AK-01',
      name: 'Pivot Alpha-1 (Alfalfa)',
      sector: 'Sector North-A',
      center: [47.265, 24.145],
      radius: 0.5,
      area: 78.5,
      crop: 'Organic Alfalfa',
      planting: '2026-03-12',
      ndvi: 0.74,
      moisture: 34,
      temp: 23.4,
      ec: 1.1,
      status: 'optimal' as const,
      irrigation: 'idle' as const,
      pass: '2026-10-01T07:22:00Z',
    },
    {
      id: 'SA-AK-02',
      name: 'Pivot Alpha-2 (Wheat-09)',
      sector: 'Sector North-A',
      center: [47.282, 24.148],
      radius: 0.52,
      area: 84.9,
      crop: 'Winter Wheat',
      planting: '2026-04-05',
      ndvi: 0.48,
      moisture: 22,
      temp: 26.8,
      ec: 1.4,
      status: 'warning' as const,
      irrigation: 'active' as const,
      action: 'Variable Rate Irrigation in progress (Moisture deficit 8%)',
      pass: '2026-10-01T07:22:00Z',
    },
    {
      id: 'SA-AK-03',
      name: 'Pivot Beta-1 (Silage Corn)',
      sector: 'Sector East-B',
      center: [47.299, 24.135],
      radius: 0.48,
      area: 72.3,
      crop: 'Silage Maize',
      planting: '2026-05-18',
      ndvi: 0.28,
      moisture: 16,
      temp: 28.5,
      ec: 1.9,
      status: 'alert' as const,
      irrigation: 'active' as const,
      action: 'Emergency irrigation cycle triggered: Root zone stress detected',
      pass: '2026-10-01T07:22:00Z',
    },
    {
      id: 'SA-AK-04',
      name: 'Pivot Beta-2 (Barley Cultivar)',
      sector: 'Sector East-B',
      center: [47.275, 24.125],
      radius: 0.55,
      area: 95.0,
      crop: 'Desert Barley',
      planting: '2026-03-29',
      ndvi: 0.68,
      moisture: 31,
      temp: 24.2,
      ec: 1.2,
      status: 'optimal' as const,
      irrigation: 'scheduled' as const,
      action: 'Scheduled drip fertigation at 22:00 UTC',
      pass: '2026-10-01T07:22:00Z',
    },
    {
      id: 'SA-AK-05',
      name: 'Pivot Gamma-1 (High-Yield Rhodes)',
      sector: 'Sector South-C',
      center: [47.292, 24.118],
      radius: 0.49,
      area: 75.4,
      crop: 'Rhodes Grass',
      planting: '2026-04-14',
      ndvi: 0.81,
      moisture: 38,
      temp: 22.8,
      ec: 0.9,
      status: 'optimal' as const,
      irrigation: 'idle' as const,
      pass: '2026-10-01T07:22:00Z',
    },
    {
      id: 'SA-AK-06',
      name: 'Pivot Gamma-2 (Fodder Sorghum)',
      sector: 'Sector South-C',
      center: [47.310, 24.122],
      radius: 0.51,
      area: 81.7,
      crop: 'Fodder Sorghum',
      planting: '2026-06-02',
      ndvi: 0.42,
      moisture: 24,
      temp: 27.1,
      ec: 1.6,
      status: 'warning' as const,
      irrigation: 'active' as const,
      action: 'Canopy temperature anomaly +2.8°C above baseline',
      pass: '2026-10-01T07:22:00Z',
    },
  ];

  for (const p of alkharjPivots) {
    features.push({
      type: 'Feature',
      id: p.id,
      geometry: {
        type: 'Polygon',
        coordinates: [createPivotCircle(p.center[0], p.center[1], p.radius)],
      },
      properties: {
        id: p.id,
        name: p.name,
        sector: p.sector,
        areaHectares: p.area,
        cropType: p.crop,
        plantingDate: p.planting,
        ndvi: p.ndvi,
        soilMoisturePct: p.moisture,
        soilTempC: p.temp,
        electricalConductivity: p.ec,
        healthStatus: p.status,
        irrigationStatus: p.irrigation,
        lastSentinelPass: p.pass,
        recommendedAction: p.action,
        weatherSummary: {
          ambientTempC: 32.4,
          humidityPct: 22,
          windSpeedKmh: 14,
          rainProbabilityPct: 0,
        },
      },
    });
  }

  // Hub 2: San Joaquin Valley Rectangular Parcels (USA)
  const sjPolygons = [
    {
      id: 'US-SJ-101',
      name: 'Orchard Block 101 (Nonpareil Almond)',
      sector: 'Westside Ag District',
      bounds: [-119.835, 36.760, -119.815, 36.745],
      area: 142.0,
      crop: 'Almonds (Drip Automated)',
      planting: '2020-02-15',
      ndvi: 0.72,
      moisture: 33,
      temp: 19.8,
      ec: 0.8,
      status: 'optimal' as const,
      irrigation: 'idle' as const,
      pass: '2026-09-30T18:40:00Z',
    },
    {
      id: 'US-SJ-102',
      name: 'Vineyard Parcel 102 (Cabernet)',
      sector: 'Westside Ag District',
      bounds: [-119.810, 36.760, -119.790, 36.745],
      area: 138.5,
      crop: 'Wine Grapes (VSP Trellis)',
      planting: '2019-04-10',
      ndvi: 0.55,
      moisture: 26,
      temp: 21.2,
      ec: 1.1,
      status: 'warning' as const,
      irrigation: 'active' as const,
      action: 'Deficit irrigation for berry veraison management',
      pass: '2026-09-30T18:40:00Z',
    },
    {
      id: 'US-SJ-103',
      name: 'Citrus Block 103 (Navel Orange)',
      sector: 'Foothill Canal Unit',
      bounds: [-119.835, 36.740, -119.815, 36.725],
      area: 140.0,
      crop: 'Navel Oranges',
      planting: '2021-03-20',
      ndvi: 0.31,
      moisture: 18,
      temp: 24.5,
      ec: 1.7,
      status: 'alert' as const,
      irrigation: 'active' as const,
      action: 'Canopy wilt index high. Flushing emitter lines.',
      pass: '2026-09-30T18:40:00Z',
    },
  ];

  for (const b of sjPolygons) {
    const [minX, minY, maxX, maxY] = b.bounds;
    features.push({
      type: 'Feature',
      id: b.id,
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [minX, minY],
            [maxX, minY],
            [maxX, maxY],
            [minX, maxY],
            [minX, minY],
          ],
        ],
      },
      properties: {
        id: b.id,
        name: b.name,
        sector: b.sector,
        areaHectares: b.area,
        cropType: b.crop,
        plantingDate: b.planting,
        ndvi: b.ndvi,
        soilMoisturePct: b.moisture,
        soilTempC: b.temp,
        electricalConductivity: b.ec,
        healthStatus: b.status,
        irrigationStatus: b.irrigation,
        lastSentinelPass: b.pass,
        recommendedAction: b.action,
        weatherSummary: {
          ambientTempC: 25.1,
          humidityPct: 41,
          windSpeedKmh: 9,
          rainProbabilityPct: 5,
        },
      },
    });
  }

  // Hub 3: Guadalquivir (Spain) Smart Olives
  features.push({
    type: 'Feature',
    id: 'ES-GQ-01',
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [-5.855, 37.420],
          [-5.830, 37.422],
          [-5.828, 37.405],
          [-5.852, 37.402],
          [-5.855, 37.420],
        ],
      ],
    },
    properties: {
      id: 'ES-GQ-01',
      name: 'Finca Carmona (Picual Olives)',
      sector: 'Guadalquivir Sector Sur',
      areaHectares: 195.4,
      cropType: 'SHD Picual Olive Groves',
      plantingDate: '2018-11-04',
      ndvi: 0.69,
      soilMoisturePct: 29,
      soilTempC: 18.5,
      electricalConductivity: 0.7,
      healthStatus: 'optimal',
      irrigationStatus: 'idle',
      lastSentinelPass: '2026-10-01T11:05:00Z',
      weatherSummary: {
        ambientTempC: 22.8,
        humidityPct: 54,
        windSpeedKmh: 12,
        rainProbabilityPct: 15,
      },
    },
  });

  return features;
}

// Generate realistic multi-sensor telemetry nodes inside parcels
function generateBaselineSensors(parcels: FieldParcelFeature[]): IoTSensorNode[] {
  const nodes: IoTSensorNode[] = [];
  const now = Date.now();

  for (const parcel of parcels) {
    const coords = parcel.geometry.coordinates[0];
    // Center point approximation
    const avgLng = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
    const avgLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;

    // Node 1: Primary Soil Multi-Depth Probe
    nodes.push({
      id: `probe-${parcel.id}-01`,
      parcelId: parcel.id,
      name: `Soil Probe [${parcel.properties.name.split(' ')[0]}]`,
      coordinates: [parseFloat(avgLng.toFixed(5)), parseFloat(avgLat.toFixed(5))],
      nodeType: 'soil_probe',
      soilMoisture20cm: parcel.properties.soilMoisturePct,
      soilMoisture60cm: Math.round(parcel.properties.soilMoisturePct * 1.15),
      temperatureC: parcel.properties.soilTempC,
      batteryPct: 94,
      signalDbm: -68,
      valveState: parcel.properties.irrigationStatus === 'active' ? 'open' : 'closed',
      flowRateLpm: parcel.properties.irrigationStatus === 'active' ? 142.5 : 0,
      alertActive: parcel.properties.healthStatus === 'alert',
      lastPing: now - Math.floor(Math.random() * 40000),
    });

    // Node 2: Smart Valve / Flow Actuator at perimeter
    const perimeterPt = coords[Math.floor(coords.length / 4)];
    nodes.push({
      id: `actuator-${parcel.id}-02`,
      parcelId: parcel.id,
      name: `Irrigation Solenoid #${parcel.id.slice(-2)}`,
      coordinates: [parseFloat(perimeterPt[0].toFixed(5)), parseFloat(perimeterPt[1].toFixed(5))],
      nodeType: 'irrigation_valve',
      soilMoisture20cm: parcel.properties.soilMoisturePct,
      soilMoisture60cm: Math.round(parcel.properties.soilMoisturePct * 1.1),
      temperatureC: parcel.properties.soilTempC + 1.2,
      batteryPct: 88,
      signalDbm: -72,
      valveState: parcel.properties.irrigationStatus === 'active' ? 'flow_pulsing' : 'closed',
      flowRateLpm: parcel.properties.irrigationStatus === 'active' ? 180.0 : 0,
      alertActive: parcel.properties.healthStatus === 'alert',
      lastPing: now - Math.floor(Math.random() * 25000),
    });
  }

  return nodes;
}

export class HasadService {
  private parcels: FieldParcelCollection;
  private sensors: IoTSensorNode[];

  constructor() {
    const rawParcels = generateBaselineParcels();
    this.parcels = {
      type: 'FeatureCollection',
      features: rawParcels,
    };
    this.sensors = generateBaselineSensors(rawParcels);
  }

  getParcels(): FieldParcelCollection {
    return this.parcels;
  }

  getHubs(): HasadAgriHub[] {
    return HASAD_HUBS;
  }

  /**
   * Returns live fluctuating IoT sensor states with natural telemetry drift
   */
  getSensors(): IoTSensorNode[] {
    const now = Date.now();
    return this.sensors.map((sensor) => {
      const isPulsing = sensor.valveState === 'flow_pulsing' || sensor.valveState === 'open';
      const jitter = (Math.random() - 0.5) * 0.4;
      const moistureJitter = isPulsing ? 0.2 : -0.05;

      return {
        ...sensor,
        soilMoisture20cm: parseFloat(Math.max(10, Math.min(60, sensor.soilMoisture20cm + moistureJitter)).toFixed(1)),
        temperatureC: parseFloat((sensor.temperatureC + jitter).toFixed(1)),
        flowRateLpm: isPulsing ? parseFloat((sensor.flowRateLpm + (Math.random() - 0.5) * 2).toFixed(1)) : 0,
        lastPing: now,
      };
    });
  }

  /**
   * Directly actuates solenoid valves for a parcel and updates real-time telemetry
   */
  actuateValve(parcelId: string, valveId?: string, action: 'OPEN' | 'CLOSE' = 'OPEN', flowRateLpm = 175.0): boolean {
    const parcel = this.parcels.features.find((p) => p.id === parcelId);
    if (!parcel) return false;

    if (action === 'OPEN') {
      parcel.properties.irrigationStatus = 'active';
      parcel.properties.recommendedAction = `Automated solenoid cycle ACTIVE (${flowRateLpm} L/min). Hydraulic recovery in progress.`;
      
      this.sensors = this.sensors.map((s) => {
        if (s.parcelId === parcelId) {
          const isTargetValve = !valveId || s.id === valveId || s.nodeType === 'irrigation_valve';
          if (isTargetValve) {
            return {
              ...s,
              valveState: 'flow_pulsing',
              flowRateLpm,
              soilMoisture20cm: parseFloat((s.soilMoisture20cm + 2.5).toFixed(1)),
              alertActive: false,
            };
          }
        }
        return s;
      });
      parcel.properties.soilMoisturePct = parseFloat((parcel.properties.soilMoisturePct + 2.5).toFixed(1));
      parcel.properties.healthStatus = parcel.properties.soilMoisturePct > 22 ? 'optimal' : 'warning';
    } else {
      parcel.properties.irrigationStatus = 'idle';
      parcel.properties.recommendedAction = 'Irrigation cycle complete. Subsurface moisture stabilized.';

      this.sensors = this.sensors.map((s) => {
        if (s.parcelId === parcelId) {
          return {
            ...s,
            valveState: 'closed',
            flowRateLpm: 0,
            alertActive: false,
          };
        }
        return s;
      });
    }

    return true;
  }


  /**
   * Fetches real-time weather radar frames from RainViewer API
   * Caches for 5 minutes in Redis / in-memory cache
   */
  async getRainViewerRadar(): Promise<RainViewerData> {
    const cached = await cache.get(REDIS_RAINVIEWER_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {}
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      const res = await fetch('https://api.rainviewer.com/public/weather-maps.json', {
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const data = (await res.json()) as RainViewerData;
        await cache.set(REDIS_RAINVIEWER_KEY, JSON.stringify(data), 'EX', CACHE_TTL_SECONDS);
        return data;
      }
    } catch (err) {
      console.warn('[HasadService] RainViewer API notice:', (err as Error).message);
    }

    // Baseline fallback frame if external API is unreachable
    const nowSec = Math.floor(Date.now() / 1000);
    const fallback: RainViewerData = {
      version: '2.0',
      generated: nowSec,
      host: 'https://tilecache.rainviewer.com',
      radar: {
        past: [
          { time: nowSec - 1800, path: '/v2/radar/1727892000' },
          { time: nowSec - 600, path: '/v2/radar/1727892600' },
        ],
        nowcast: [
          { time: nowSec + 600, path: '/v2/radar/nowcast_1727893800' },
        ],
      },
    };

    return fallback;
  }
}

export const hasadService = new HasadService();
