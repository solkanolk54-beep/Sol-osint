import { ScatterplotLayer } from '@deck.gl/layers';
import type { EarthquakeFeature } from '../../types/telemetry.ts';

export interface EarthquakeLayerProps {
  features: EarthquakeFeature[];
  selectedId: string | null;
  minMagnitude: number;
  pulsePhase: number; // 0 to 1
  onSelectEarthquake: (feature: EarthquakeFeature) => void;
}

export function createEarthquakeLayers(props: EarthquakeLayerProps) {
  const { features, selectedId, minMagnitude, pulsePhase, onSelectEarthquake } = props;

  const filtered = features.filter((f) => f.properties.mag >= minMagnitude);
  const layers: any[] = [];

  // 1. Shockwave Ripple Layer (expands & fades out)
  layers.push(
    new ScatterplotLayer<EarthquakeFeature>({
      id: 'earthquake-shockwave',
      data: filtered,
      pickable: false,
      stroked: true,
      filled: false,
      radiusScale: 1000,
      radiusMinPixels: 4,
      radiusMaxPixels: 65,
      lineWidthMinPixels: 1.5,
      getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1], 0],
      getRadius: (d) => {
        const mag = Math.max(1, d.properties.mag);
        const baseRadiusKm = Math.pow(2, mag) * 12;
        return baseRadiusKm * (0.4 + pulsePhase * 1.2);
      },
      getLineColor: (d) => {
        const mag = d.properties.mag;
        const alpha = Math.max(0, Math.floor((1 - pulsePhase) * 220));
        if (mag >= 5.5) return [239, 68, 68, alpha];
        if (mag >= 4.0) return [249, 115, 22, alpha];
        return [234, 179, 8, Math.floor(alpha * 0.7)];
      },
    })
  );

  // 2. Core Epicenter (Pickable)
  layers.push(
    new ScatterplotLayer<EarthquakeFeature>({
      id: 'earthquake-core',
      data: filtered,
      pickable: true,
      stroked: true,
      filled: true,
      radiusScale: 1000,
      radiusMinPixels: 3,
      radiusMaxPixels: 20,
      lineWidthMinPixels: 1.5,
      getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1], 0],
      getRadius: (d) => {
        const mag = Math.max(1, d.properties.mag);
        return Math.pow(1.8, mag) * 4;
      },
      getFillColor: (d) => {
        const isSelected = d.id === selectedId;
        if (isSelected) return [255, 255, 255, 255];
        const mag = d.properties.mag;
        if (mag >= 6.0) return [220, 38, 38, 255];
        if (mag >= 5.0) return [239, 68, 68, 240];
        if (mag >= 4.0) return [249, 115, 22, 230];
        return [234, 179, 8, 210];
      },
      getLineColor: (d) => {
        return d.id === selectedId ? [239, 68, 68, 255] : [20, 20, 20, 180];
      },
      onClick: (info) => {
        if (info.object) {
          onSelectEarthquake(info.object);
        }
      },
    })
  );

  return layers;
}
