import * as satellite from 'satellite.js';

interface RawSatInput {
  id: number;
  name: string;
  category: string;
  line1: string;
  line2: string;
  inclination: number;
  periodMinutes: number;
}

// In-worker cached satrec map to avoid re-parsing TLE strings every tick
const satrecCache = new Map<number, satellite.SatRec>();

self.onmessage = (e: MessageEvent) => {
  const { satRecords, timestamp } = e.data as {
    satRecords: RawSatInput[];
    timestamp?: number;
  };

  if (!Array.isArray(satRecords)) {
    self.postMessage([]);
    return;
  }

  const simDate = timestamp ? new Date(timestamp) : new Date();
  const gmst = satellite.gstime(simDate);

  const positions: Array<{
    id: number;
    name: string;
    category: string;
    lat: number;
    lng: number;
    alt: number;
    velocityKmS: number;
    inclination: number;
    periodMinutes: number;
  }> = [];

  for (let i = 0; i < satRecords.length; i++) {
    const sat = satRecords[i];
    let satrec = satrecCache.get(sat.id);
    if (!satrec) {
      try {
        satrec = satellite.twoline2satrec(sat.line1, sat.line2);
        satrecCache.set(sat.id, satrec);
      } catch {
        continue;
      }
    }

    try {
      const pv = satellite.propagate(satrec, simDate);
      const positionEci = pv.position;
      const velocityEci = pv.velocity;

      if (positionEci && typeof positionEci !== 'boolean') {
        const positionGd = satellite.eciToGeodetic(positionEci, gmst);
        const lat = satellite.degreesLat(positionGd.latitude);
        const lng = satellite.degreesLong(positionGd.longitude);
        const alt = Math.max(100, Math.round(positionGd.height));

        let velocityKmS = 7.5;
        if (velocityEci && typeof velocityEci !== 'boolean') {
          const vx = velocityEci.x;
          const vy = velocityEci.y;
          const vz = velocityEci.z;
          velocityKmS = parseFloat(Math.sqrt(vx * vx + vy * vy + vz * vz).toFixed(2));
        }

        if (!isNaN(lat) && !isNaN(lng)) {
          positions.push({
            id: sat.id,
            name: sat.name,
            category: sat.category,
            lat: parseFloat(lat.toFixed(4)),
            lng: parseFloat(lng.toFixed(4)),
            alt,
            velocityKmS,
            inclination: sat.inclination,
            periodMinutes: sat.periodMinutes,
          });
        }
      }
    } catch {
      // Continue next
    }
  }

  self.postMessage(positions);
};
