export interface ParcelProperties {
  id: string;
  name: string;
  sector: string;
  areaHectares: number;
  cropType: string;
  plantingDate: string;
  ndvi: number; // 0.00 to 1.00
  soilMoisturePct: number; // e.g., 18% to 42%
  soilTempC: number;
  electricalConductivity: number; // dS/m
  healthStatus: 'optimal' | 'warning' | 'alert';
  irrigationStatus: 'active' | 'idle' | 'scheduled';
  lastSentinelPass: string;
  recommendedAction?: string;
  weatherSummary: {
    ambientTempC: number;
    humidityPct: number;
    windSpeedKmh: number;
    rainProbabilityPct: number;
  };
}

export interface FieldParcelFeature {
  type: 'Feature';
  id: string;
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: ParcelProperties;
}

export interface FieldParcelCollection {
  type: 'FeatureCollection';
  features: FieldParcelFeature[];
}

export interface IoTSensorNode {
  id: string;
  parcelId: string;
  name: string;
  coordinates: [number, number]; // [longitude, latitude]
  nodeType: 'soil_probe' | 'weather_station' | 'irrigation_valve' | 'dendrometer';
  soilMoisture20cm: number; // %
  soilMoisture60cm: number; // %
  temperatureC: number;
  batteryPct: number;
  signalDbm: number;
  valveState: 'open' | 'closed' | 'flow_pulsing';
  flowRateLpm: number;
  alertActive: boolean;
  lastPing: number;
}

export interface RainViewerFrame {
  time: number;
  path: string;
}

export interface RainViewerData {
  version: string;
  generated: number;
  host: string;
  radar: {
    past: RainViewerFrame[];
    nowcast: RainViewerFrame[];
  };
}

export interface HasadAgriHub {
  id: string;
  name: string;
  country: string;
  coordinates: [number, number]; // [lng, lat]
  zoom: number;
  pitch: number;
  hectares: number;
  cropTypes: string[];
}
