import { ScatterplotLayer } from '@deck.gl/layers';
import type { WeatherIncident } from '../../types/telemetry.ts';

export interface IncidentLayerProps {
  incidents: WeatherIncident[];
  selectedId: string | null;
  visible: boolean;
  pulsePhase: number;
  onSelectIncident: (incident: WeatherIncident) => void;
}

export function createIncidentLayers(props: IncidentLayerProps) {
  const { incidents, selectedId, visible, pulsePhase, onSelectIncident } = props;

  if (!visible || incidents.length === 0) return [];

  const layers: any[] = [];

  // Pulsing weather anomaly circle
  layers.push(
    new ScatterplotLayer<WeatherIncident>({
      id: 'weather-incidents-pulse',
      data: incidents,
      pickable: false,
      stroked: true,
      filled: false,
      radiusScale: 1000,
      radiusMinPixels: 6,
      radiusMaxPixels: 50,
      lineWidthMinPixels: 1.5,
      getPosition: (d) => [d.coordinates[0], d.coordinates[1], 0],
      getRadius: (d) => 150000 * (0.5 + pulsePhase),
      getLineColor: (d) => {
        const alpha = Math.floor((1 - pulsePhase) * 200);
        return d.category === 'Tropical Cyclone' ? [239, 68, 68, alpha] : [14, 165, 233, alpha];
      },
    })
  );

  // Core marker
  layers.push(
    new ScatterplotLayer<WeatherIncident>({
      id: 'weather-incidents-core',
      data: incidents,
      pickable: true,
      stroked: true,
      filled: true,
      radiusMinPixels: 5,
      radiusMaxPixels: 12,
      lineWidthMinPixels: 1.5,
      getPosition: (d) => [d.coordinates[0], d.coordinates[1], 0],
      getRadius: 10,
      getFillColor: (d) => (d.category === 'Tropical Cyclone' ? [239, 68, 68, 240] : [56, 189, 248, 240]),
      getLineColor: (d) => (d.id === selectedId ? [255, 255, 255, 255] : [15, 23, 42, 200]),
      onClick: (info) => {
        if (info.object) onSelectIncident(info.object);
      },
    })
  );

  return layers;
}
