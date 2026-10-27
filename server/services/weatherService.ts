import * as SunCalcModule from 'suncalc';
import { cache } from '../redisClient.ts';
import type { GeoJsonPolygon, WeatherIncident } from '../../src/types/telemetry.ts';

const SunCalc = (SunCalcModule as any).default || SunCalcModule;

export type { GeoJsonPolygon, WeatherIncident };

const REDIS_TERMINATOR_KEY = 'geo:sun:terminator';

export class WeatherService {
  /**
   * Computes the Solar Terminator polygon for the provided date (default Date.now())
   * Returns a valid GeoJSON Feature with coordinates outlining the night hemisphere.
   */
  generateSolarTerminator(date: Date = new Date()): GeoJsonPolygon {
    // 1. Calculate approximate subsolar coordinates using SunCalc
    const sunPos0 = SunCalc.getPosition(date, 0, 0);

    // Exact solar declination approximation:
    const startOfYear = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const dayOfYear = (date.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24);
    // Declination in radians
    const declinationRad = 23.44 * (Math.PI / 180) * Math.sin(((2 * Math.PI) / 365.25) * (dayOfYear - 80));
    const declinationDeg = declinationRad * (180 / Math.PI);

    // Greenwich Hour Angle (subsolar longitude)
    const utcHours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;
    const subsolarLng = -((utcHours - 12) * 15);
    const subsolarLat = declinationDeg;

    // 2. Build the terminator ring
    const ring: number[][] = [];
    const step = 2; // Every 2 degrees for smooth WebGL curve

    for (let lng = -180; lng <= 180; lng += step) {
      const hRad = ((lng - subsolarLng) * Math.PI) / 180;
      let latDeg = 0;
      if (Math.abs(Math.tan(declinationRad)) < 1e-6) {
        latDeg = (Math.sin(hRad) >= 0 ? 1 : -1) * 90;
      } else {
        const tanLat = -Math.cos(hRad) / Math.tan(declinationRad);
        latDeg = Math.atan(tanLat) * (180 / Math.PI);
      }

      latDeg = Math.max(-89.9, Math.min(89.9, latDeg));
      ring.push([lng, latDeg]);
    }

    // 3. Close the polygon along the night-covered polar cap
    const polarLat = declinationDeg >= 0 ? -90 : 90;

    ring.push([180, polarLat]);
    ring.push([-180, polarLat]);
    ring.push(ring[0]); // Close ring

    return {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [ring],
      },
      properties: {
        title: 'Solar Day/Night Terminator',
        timestamp: date.toISOString(),
        solarDeclinationDeg: parseFloat(declinationDeg.toFixed(2)),
        subsolarLngDeg: parseFloat(subsolarLng.toFixed(2)),
        subsolarLatDeg: parseFloat(subsolarLat.toFixed(2)),
      },
    };
  }

  async getCachedTerminator(): Promise<GeoJsonPolygon> {
    const cached = await cache.get(REDIS_TERMINATOR_KEY);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // regenerate
      }
    }
    const poly = this.generateSolarTerminator();
    await cache.set(REDIS_TERMINATOR_KEY, JSON.stringify(poly), 'EX', 60);
    return poly;
  }

  getWeatherIncidents(): WeatherIncident[] {
    const now = Date.now();
    return [
      {
        id: 'wx-tc-01',
        name: 'Super Typhoon KONG-REY',
        category: 'Tropical Cyclone',
        coordinates: [124.6, 21.8],
        intensity: 'Cat 4 Equivalent',
        windSpeedKts: 130,
        pressureHpa: 935,
        updated: now - 1000 * 60 * 15,
      },
      {
        id: 'wx-tc-02',
        name: 'Tropical Storm TRAMI',
        category: 'Tropical Cyclone',
        coordinates: [111.4, 16.2],
        intensity: 'Severe Tropical Storm',
        windSpeedKts: 55,
        pressureHpa: 985,
        updated: now - 1000 * 60 * 30,
      },
      {
        id: 'wx-anomaly-01',
        name: 'North Atlantic Polar Vortex Jet Disruption',
        category: 'Atmospheric Anomaly',
        coordinates: [-34.2, 58.6],
        intensity: 'Jet Stream Core 185 kts',
        windSpeedKts: 185,
        pressureHpa: 960,
        updated: now - 1000 * 60 * 45,
      },
      {
        id: 'wx-geo-01',
        name: 'G3 Strong Geomagnetic Storm Event',
        category: 'Geomagnetic Storm',
        coordinates: [10.5, 68.2],
        intensity: 'Kp Index 7.0 - Aurora Borealis Visible to 45°N',
        windSpeedKts: 0,
        pressureHpa: 0,
        updated: now - 1000 * 60 * 10,
      },
    ];
  }
}

export const weatherService = new WeatherService();
