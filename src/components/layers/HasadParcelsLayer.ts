import { GeoJsonLayer } from '@deck.gl/layers';
import type { FieldParcelCollection, FieldParcelFeature } from '../../types/hasad.ts';

export interface HasadParcelsLayerProps {
  parcels: FieldParcelCollection | null;
  selectedParcelId: string | null;
  visible: boolean;
  animationTick?: number;
  onSelectParcel: (parcel: FieldParcelFeature) => void;
}

export function createHasadParcelsLayer(props: HasadParcelsLayerProps) {
  const { parcels, selectedParcelId, visible, animationTick = Date.now() / 1000, onSelectParcel } = props;

  if (!visible || !parcels || !parcels.features.length) {
    return [];
  }

  // Actively irrigating parcels for the animated water flow pulse
  const activeParcels = parcels.features.filter(
    (f) => f.properties?.irrigationStatus === 'active'
  );

  // Compute glowing water pulse alpha & width using sine phase
  const pulseAlpha = Math.round(185 + 70 * Math.sin(animationTick * 5));
  const glowWidth = 3.5 + 1.5 * Math.sin(animationTick * 5);

  const layers: any[] = [
    // 1. Base 3D Field Parcels
    new GeoJsonLayer<FieldParcelFeature>({
      id: 'hasad-field-parcels',
      data: parcels,
      pickable: true,
      stroked: true,
      filled: true,
      extruded: true,
      wireframe: true,
      lineWidthMinPixels: 2,
      // Dynamic 3D extrusion based on NDVI health score
      getElevation: (d: any) => {
        const ndvi = d.properties?.ndvi ?? 0.5;
        return Math.max(15, Math.round(ndvi * 120));
      },
      // Dynamic color-coding according to specification with active irrigation water glow
      getFillColor: (d: any) => {
        const isSelected = d.id === selectedParcelId;
        const isActive = d.properties?.irrigationStatus === 'active';
        const ndvi = d.properties?.ndvi ?? 0.5;

        if (isSelected) {
          return [0, 240, 255, 220]; // Cyan highlight on selection
        }

        if (isActive) {
          // Aquamarine water glow tint when irrigation is active
          return [14, 165, 233, 175];
        }

        if (ndvi > 0.6) {
          return [34, 197, 94, 180];
        }
        if (ndvi >= 0.35) {
          return [234, 179, 8, 180];
        }
        return [239, 68, 68, 180];
      },
      getLineColor: (d: any) => {
        const isSelected = d.id === selectedParcelId;
        const isActive = d.properties?.irrigationStatus === 'active';

        if (isSelected) {
          return [255, 255, 255, 255];
        }
        if (isActive) {
          // Radiant pulsing cyan water beam
          return [6, 182, 212, pulseAlpha];
        }

        const ndvi = d.properties?.ndvi ?? 0.5;
        if (ndvi > 0.6) return [74, 222, 128, 230];
        if (ndvi >= 0.35) return [250, 204, 21, 230];
        return [248, 113, 113, 230];
      },
      getLineWidth: (d: any) => {
        if (d.properties?.irrigationStatus === 'active') {
          return glowWidth;
        }
        return 2;
      },
      onClick: (info) => {
        if (info.object) {
          onSelectParcel(info.object as FieldParcelFeature);
        }
      },
      updateTriggers: {
        getLineColor: [animationTick, selectedParcelId],
        getFillColor: [selectedParcelId],
        getLineWidth: [animationTick],
      },
    }),
  ];

  // 2. Secondary Glowing Water Flow Pulse Ring around active parcels
  if (activeParcels.length > 0) {
    layers.push(
      new GeoJsonLayer({
        id: 'hasad-active-irrigation-pulse',
        data: {
          type: 'FeatureCollection',
          features: activeParcels,
        },
        pickable: false,
        stroked: true,
        filled: false,
        extruded: false,
        lineWidthMinPixels: 4,
        getLineColor: [34, 211, 238, pulseAlpha],
        getLineWidth: glowWidth * 1.5,
        updateTriggers: {
          getLineColor: [pulseAlpha],
          getLineWidth: [glowWidth],
        },
      })
    );
  }

  return layers;
}
