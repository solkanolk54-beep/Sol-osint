import * as satellite from 'satellite.js';
import type { SatelliteMetadata } from '../types/telemetry.ts';

export interface CalculatedSatellitePosition {
  id: number;
  name: string;
  category: SatelliteMetadata['category'];
  longitude: number;
  latitude: number;
  altitudeKm: number;
  velocityKmS: number;
  line1: string;
  line2: string;
  inclination: number;
  periodMinutes: number;
  satrec?: satellite.SatRec;
}

export interface OrbitPathSegment {
  path: [number, number, number][]; // [lng, lat, altKm]
  name: string;
  id: number;
}

/**
 * Splits polyline paths crossing the antimeridian (+180° / -180° longitude)
 * into separate continuous segments to eliminate horizontal cross-globe visual artifacts.
 */
export function splitAntimeridianPath(coordinates: [number, number][]): [number, number][][] {
  const segments: [number, number][][] = [];
  let currentSegment: [number, number][] = [];

  for (let i = 0; i < coordinates.length; i++) {
    const current = coordinates[i];
    if (i > 0) {
      const prev = coordinates[i - 1];
      // If longitude jumped by more than 180 degrees, split segment
      if (Math.abs(current[0] - prev[0]) > 180) {
        if (currentSegment.length > 0) segments.push(currentSegment);
        currentSegment = [];
      }
    }
    currentSegment.push(current);
  }
  if (currentSegment.length > 0) segments.push(currentSegment);
  return segments;
}

/**
 * Propagate a satellite TLE to geodetic coordinates for a given date
 */
export function getSatellitePosition(
  sat: SatelliteMetadata,
  date: Date = new Date()
): CalculatedSatellitePosition | null {
  try {
    const satrec = satellite.twoline2satrec(sat.line1, sat.line2);
    if ((satrec as any).error) return null;

    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity.position;
    const velocityEci = positionAndVelocity.velocity;

    if (!positionEci || typeof positionEci === 'boolean' || !velocityEci || typeof velocityEci === 'boolean') {
      return null;
    }

    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEci, gmst);

    const longitude = satellite.degreesLong(geodetic.longitude);
    const latitude = satellite.degreesLat(geodetic.latitude);
    const altitudeKm = Math.max(100, Math.round(geodetic.height));

    const vx = velocityEci.x;
    const vy = velocityEci.y;
    const vz = velocityEci.z;
    const velocityKmS = parseFloat(Math.sqrt(vx * vx + vy * vy + vz * vz).toFixed(2));

    return {
      id: sat.id,
      name: sat.name,
      category: sat.category,
      longitude: parseFloat(longitude.toFixed(4)),
      latitude: parseFloat(latitude.toFixed(4)),
      altitudeKm,
      velocityKmS,
      line1: sat.line1,
      line2: sat.line2,
      inclination: sat.inclination,
      periodMinutes: Math.round(sat.periodMinutes),
      satrec,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Computes forward and backward orbital trajectory points for a satellite
 * Splits trajectory at date line (+180/-180) to prevent cross-globe horizontal rendering artifacts
 */
export function computeOrbitPath(
  satrec: satellite.SatRec,
  name: string,
  id: number,
  baseDate: Date = new Date(),
  durationMinutes = 95,
  stepMinutes = 1
): OrbitPathSegment[] {
  const segments: OrbitPathSegment[] = [];
  let currentSegment: [number, number, number][] = [];

  const totalSteps = Math.ceil(durationMinutes / stepMinutes);
  let prevLng: number | null = null;

  for (let i = -10; i <= totalSteps; i++) {
    const timeOffset = i * stepMinutes * 60 * 1000;
    const date = new Date(baseDate.getTime() + timeOffset);
    const pv = satellite.propagate(satrec, date);

    if (pv.position && typeof pv.position !== 'boolean') {
      const gmst = satellite.gstime(date);
      const geodetic = satellite.eciToGeodetic(pv.position, gmst);
      const lng = satellite.degreesLong(geodetic.longitude);
      const lat = satellite.degreesLat(geodetic.latitude);
      const alt = Math.max(100, geodetic.height);

      // Check for antimeridian crossing (e.g. jump from +179 to -179)
      if (prevLng !== null && Math.abs(lng - prevLng) > 180) {
        if (currentSegment.length > 1) {
          segments.push({ path: currentSegment, name, id });
        }
        currentSegment = [];
      }

      currentSegment.push([lng, lat, alt]);
      prevLng = lng;
    }
  }

  if (currentSegment.length > 1) {
    segments.push({ path: currentSegment, name, id });
  }

  return segments;
}
