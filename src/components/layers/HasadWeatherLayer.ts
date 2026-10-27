import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import type { RainViewerData } from '../../types/hasad.ts';

export interface HasadWeatherLayerProps {
  radarData: RainViewerData | null;
  visible: boolean;
  opacity?: number; // default 0.55
}

export function createHasadWeatherLayer(props: HasadWeatherLayerProps) {
  const { radarData, visible, opacity = 0.55 } = props;

  if (!visible || !radarData) {
    return [];
  }

  // Find the latest radar frame (latest past frame or earliest nowcast)
  const pastFrames = radarData.radar?.past || [];
  const latestFrame = pastFrames.length > 0 ? pastFrames[pastFrames.length - 1] : null;

  if (!latestFrame || !latestFrame.path) {
    return [];
  }

  const host = radarData.host || 'https://tilecache.rainviewer.com';
  // RainViewer tile format: {host}{path}/256/{z}/{x}/{y}/2/1_1.png
  // 2 = Universal radar color palette, 1_1 = smoothed precipitation
  const tileUrlTemplate = `${host}${latestFrame.path}/256/{z}/{x}/{y}/2/1_1.png`;

  return [
    new TileLayer({
      id: `hasad-weather-radar-${latestFrame.time}`,
      data: tileUrlTemplate,
      minZoom: 0,
      maxZoom: 12,
      tileSize: 256,
      opacity,
      pickable: false,
      onTileError: () => {
        // Silently handle empty ocean tiles where radar data does not exist
      },
      renderSubLayers: (subProps: any) => {
        if (!subProps.data) return null;

        const {
          bbox: { west, south, east, north },
        } = subProps.tile;

        return new BitmapLayer({
          id: subProps.id,
          data: [] as any,
          numInstances: 0,
          image: subProps.data,
          bounds: [west, south, east, north],
        } as any);
      },
    }),
  ];
}
