import { TileLayer } from '@deck.gl/geo-layers';
import { BitmapLayer } from '@deck.gl/layers';
import type { FieldParcelCollection, FieldParcelFeature } from '../../types/hasad.ts';

export interface HasadSentinelLayerProps {
  parcels: FieldParcelCollection | null;
  selectedParcel?: FieldParcelFeature | null;
  visible: boolean;
  opacity?: number; // 0.0 to 1.0
  selectedDate?: string;
  activeHubBounds?: [number, number, number, number] | null; // [minLng, minLat, maxLng, maxLat]
}

/**
 * Computes bounding box covering active parcels or active agricultural sector
 * to restrict tile fetching strictly to farm boundaries
 */
function getActiveExtent(
  parcels: FieldParcelCollection | null,
  selectedParcel?: FieldParcelFeature | null,
  activeHubBounds?: [number, number, number, number] | null
): [number, number, number, number] {
  if (selectedParcel?.geometry?.coordinates?.[0]?.length) {
    const coords = selectedParcel.geometry.coordinates[0];
    let minLng = 180;
    let minLat = 90;
    let maxLng = -180;
    let maxLat = -90;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
    }
    return [minLng - 0.05, minLat - 0.05, maxLng + 0.05, maxLat + 0.05];
  }

  if (activeHubBounds) {
    return activeHubBounds;
  }

  if (parcels && parcels.features.length > 0) {
    // Center bounding box on the agricultural hub
    const firstFeatureCoords = parcels.features[0].geometry.coordinates[0];
    const centerLng = firstFeatureCoords[0][0];
    const centerLat = firstFeatureCoords[0][1];
    return [centerLng - 0.15, centerLat - 0.15, centerLng + 0.15, centerLat + 0.15];
  }

  // Safe default: Al-Kharj Center-Pivot Basin [minLng, minLat, maxLng, maxLat]
  return [47.15, 24.02, 47.42, 24.25];
}

export function createHasadSentinelLayer(props: HasadSentinelLayerProps) {
  const { parcels, selectedParcel, visible, opacity = 0.75, selectedDate, activeHubBounds } = props;

  if (!visible) {
    return [];
  }

  const bbox = getActiveExtent(parcels, selectedParcel, activeHubBounds);

  // Determine Sentinel-2 cloudless layer name based on selected date
  let mosaicLayer = 's2cloudless-2024_3857';
  if (selectedDate?.includes('2020')) {
    mosaicLayer = 's2cloudless-2020_3857';
  } else if (selectedDate?.includes('2022')) {
    mosaicLayer = 's2cloudless-2022_3857';
  }

  return [
    new TileLayer({
      id: `hasad-sentinel2-${mosaicLayer}`,
      minZoom: 6,
      maxZoom: 14,
      tileSize: 256,
      opacity,
      pickable: false,
      // Restrict tile fetching strictly to bounding box of active field parcels to conserve bandwidth
      extent: bbox,
      // Resilient tile loader with primary Sentinel-2 and high-res satellite fallback
      getTileData: async (tile: any) => {
        const { index } = tile;
        // In EOX WMTS 1.0.0 (EPSG:3857): {z}/{TileRow}/{TileCol} -> {z}/{y}/{x}
        // In standard slippy map / Esri: {z}/{y}/{x}
        const candidateUrls = [
          `https://tiles.maps.eox.at/wmts/1.0.0/${mosaicLayer}/default/g/${index.z}/${index.y}/${index.x}.jpg`,
          `https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/${index.z}/${index.y}/${index.x}`,
        ];

        for (const url of candidateUrls) {
          try {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 6000);
            const res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);

            if (res.ok) {
              const blob = await res.blob();
              if (typeof createImageBitmap === 'function') {
                return await createImageBitmap(blob);
              }
              return await new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = URL.createObjectURL(blob);
              });
            }
          } catch {
            // Non-fatal, try next candidate
          }
        }
        return null;
      },
      onTileError: () => {
        // Silently swallow any edge-of-bounds tile errors to prevent main thread warnings
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
          // False-color / NDVI vegetation reflectance enhancement tint
          tintColor: [240, 255, 220],
        } as any);
      },
    }),
  ];
}
