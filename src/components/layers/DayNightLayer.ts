import { GeoJsonLayer } from '@deck.gl/layers';
import type { GeoJsonPolygon } from '../../types/telemetry.ts';

export interface DayNightLayerProps {
  terminatorData: GeoJsonPolygon | null;
  visible: boolean;
}

export function createDayNightLayer(props: DayNightLayerProps) {
  const { terminatorData, visible } = props;

  if (!visible || !terminatorData) {
    return [];
  }

  return [
    new GeoJsonLayer({
      id: 'day-night-terminator',
      data: terminatorData,
      pickable: false,
      stroked: true,
      filled: true,
      extruded: false,
      lineWidthMinPixels: 2,
      getFillColor: [5, 10, 24, 135], // Atmospheric dark night shadow
      getLineColor: [245, 158, 11, 140], // Warm solar terminator boundary line
    }),
  ];
}
