import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import type { TelemetryFeature } from '../../types/telemetry.ts';

export interface TelemetryLayerProps {
  features: TelemetryFeature[];
  selectedId: string | null;
  showAviation: boolean;
  showMaritime: boolean;
  onSelectTelemetry: (feature: TelemetryFeature) => void;
}

export function createTelemetryLayers(props: TelemetryLayerProps) {
  const { features, selectedId, showAviation, showMaritime, onSelectTelemetry } = props;

  const aviation = showAviation ? features.filter((f) => f.properties.category === 'aviation') : [];
  const maritime = showMaritime ? features.filter((f) => f.properties.category === 'maritime') : [];

  const layers: any[] = [];

  // 1. Aviation Heading Vectors (directional heading trail)
  if (aviation.length > 0) {
    const headingVectors = aviation.map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const headingRad = (f.properties.heading * Math.PI) / 180;
      // 0.4 degree heading vector
      const endLng = lng + Math.sin(headingRad) * 0.45;
      const endLat = lat + Math.cos(headingRad) * 0.45;
      return {
        id: f.properties.id,
        path: [[lng, lat], [endLng, endLat]],
        selected: f.properties.id === selectedId,
      };
    });

    layers.push(
      new PathLayer({
        id: 'aviation-heading-vectors',
        data: headingVectors,
        pickable: false,
        widthMinPixels: 1.5,
        getPath: (d: any) => d.path,
        getColor: (d: any) => (d.selected ? [0, 255, 255, 255] : [56, 189, 248, 160]),
      })
    );

    // Aircraft Core Markers
    layers.push(
      new ScatterplotLayer<TelemetryFeature>({
        id: 'aviation-markers',
        data: aviation,
        pickable: true,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 3.5,
        radiusMaxPixels: 9,
        lineWidthMinPixels: 1,
        getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1], d.properties.altitude],
        getRadius: (d) => (d.properties.id === selectedId ? 9 : 4),
        getFillColor: (d) => (d.properties.id === selectedId ? [255, 255, 255, 255] : [56, 189, 248, 240]),
        getLineColor: (d) => (d.properties.id === selectedId ? [0, 240, 255, 255] : [15, 23, 42, 200]),
        onClick: (info) => {
          if (info.object) onSelectTelemetry(info.object);
        },
      })
    );
  }

  // 2. Maritime AIS Traffic
  if (maritime.length > 0) {
    const maritimeHeadingVectors = maritime.map((f) => {
      const [lng, lat] = f.geometry.coordinates;
      const headingRad = (f.properties.heading * Math.PI) / 180;
      const endLng = lng + Math.sin(headingRad) * 0.25;
      const endLat = lat + Math.cos(headingRad) * 0.25;
      return {
        id: f.properties.id,
        path: [[lng, lat], [endLng, endLat]],
        selected: f.properties.id === selectedId,
      };
    });

    layers.push(
      new PathLayer({
        id: 'maritime-heading-vectors',
        data: maritimeHeadingVectors,
        pickable: false,
        widthMinPixels: 1.2,
        getPath: (d: any) => d.path,
        getColor: (d: any) => (d.selected ? [52, 211, 153, 255] : [20, 184, 166, 150]),
      })
    );

    layers.push(
      new ScatterplotLayer<TelemetryFeature>({
        id: 'maritime-markers',
        data: maritime,
        pickable: true,
        stroked: true,
        filled: true,
        radiusScale: 1,
        radiusMinPixels: 3,
        radiusMaxPixels: 8,
        lineWidthMinPixels: 1,
        getPosition: (d) => [d.geometry.coordinates[0], d.geometry.coordinates[1], 0],
        getRadius: (d) => (d.properties.id === selectedId ? 8 : 4),
        getFillColor: (d) => {
          if (d.properties.id === selectedId) return [255, 255, 255, 255];
          const sub = d.properties.subType.toLowerCase();
          if (sub.includes('tanker')) return [244, 63, 94, 230]; // Coral Red
          if (sub.includes('container') || sub.includes('cargo')) return [45, 212, 191, 230]; // Teal
          if (sub.includes('passenger')) return [250, 204, 21, 230]; // Gold
          return [56, 189, 248, 220]; // Light Blue
        },
        getLineColor: (d) => (d.properties.id === selectedId ? [52, 211, 153, 255] : [10, 15, 20, 180]),
        onClick: (info) => {
          if (info.object) onSelectTelemetry(info.object);
        },
      })
    );
  }

  return layers;
}
