export interface SatelliteMetadata {
  id: number;
  name: string;
  line1: string;
  line2: string;
  category: 'Space Station' | 'Science & Weather' | 'Navigation' | 'Communications' | 'Earth Observation' | 'Debris & Other';
  inclination: number; // degrees
  eccentricity: number;
  periodMinutes: number;
  meanMotion: number; // revs/day
  epochYear: number;
  epochDay: number;
  intlDesig: string;
}

export interface EarthquakeFeature {
  type: 'Feature';
  id: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    updated: number;
    tz: number | null;
    url: string;
    detail: string;
    felt: number | null;
    cdi: number | null;
    mmi: number | null;
    alert: 'green' | 'yellow' | 'orange' | 'red' | null;
    status: string;
    tsunami: number;
    sig: number;
    net: string;
    code: string;
    ids: string;
    sources: string;
    types: string;
    nst: number | null;
    dmin: number | null;
    rms: number | null;
    gap: number | null;
    magType: string;
    type: string;
    title: string;
  };
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [longitude, latitude, depth_km]
  };
}

export interface EarthquakeFeed {
  type: 'FeatureCollection';
  metadata: {
    generated: number;
    url: string;
    title: string;
    status: number;
    api: string;
    count: number;
  };
  features: EarthquakeFeature[];
}

export interface TelemetryFeature {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number, number]; // [lng, lat, alt]
  };
  properties: {
    id: string;
    callsign: string;
    category: 'aviation' | 'maritime';
    subType: string;
    speed: number;
    speedKts: number;
    heading: number;
    altitude: number;
    altitudeFt: number;
    origin?: string;
    destination?: string;
    country?: string;
    status: string;
    lastUpdate: number;
  };
}

export interface TelemetryFeed {
  type: 'FeatureCollection';
  metadata: {
    generated: number;
    count: number;
    aviationCount: number;
    maritimeCount: number;
  };
  features: TelemetryFeature[];
}

export interface GeoJsonPolygon {
  type: 'Feature';
  geometry: {
    type: 'Polygon';
    coordinates: number[][][];
  };
  properties: {
    title: string;
    timestamp: string;
    solarDeclinationDeg: number;
    subsolarLngDeg: number;
    subsolarLatDeg: number;
  };
}

export interface WeatherIncident {
  id: string;
  name: string;
  category: 'Tropical Cyclone' | 'Severe Storm' | 'Atmospheric Anomaly' | 'Geomagnetic Storm';
  coordinates: [number, number];
  intensity: string;
  windSpeedKts: number;
  pressureHpa: number;
  updated: number;
}
