import { ScatterplotLayer } from '@deck.gl/layers';
import { PathLayer } from '@deck.gl/layers';
import type { CalculatedSatellitePosition, OrbitPathSegment } from '../../utils/satelliteMath.ts';

export interface SatelliteLayerProps {
  satellites: CalculatedSatellitePosition[];
  selectedSatId: number | null;
  orbitSegments: OrbitPathSegment[];
  onSelectSatellite: (sat: CalculatedSatellitePosition) => void;
  showOrbits: boolean;
  filterCategory: string;
}

export function createSatelliteLayers(props: SatelliteLayerProps) {
  const { satellites, selectedSatId, orbitSegments, onSelectSatellite, showOrbits, filterCategory } = props;

  const filtered = filterCategory === 'ALL'
    ? satellites
    : satellites.filter((s) => s.category.toUpperCase().includes(filterCategory.toUpperCase()));

  const layers: any[] = [];

  // 1. Orbital Path Layer (for selected satellite & prominent space stations)
  if (showOrbits && orbitSegments.length > 0) {
    layers.push(
      new PathLayer<OrbitPathSegment>({
        id: 'satellite-orbit-paths',
        data: orbitSegments,
        pickable: false,
        widthScale: 1,
        widthMinPixels: 1.5,
        getPath: (d: any) => d.path,
        getColor: (d: any) => (d.id === selectedSatId ? [0, 240, 255, 230] : [0, 200, 220, 90]),
        getWidth: (d: any) => (d.id === selectedSatId ? 2.5 : 1.2),
      })
    );
  }

  // 2. Halo glow layer
  layers.push(
    new ScatterplotLayer<CalculatedSatellitePosition>({
      id: 'satellite-glow',
      data: filtered,
      pickable: false,
      opacity: 0.35,
      stroked: false,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 6,
      radiusMaxPixels: 24,
      getPosition: (d) => [d.longitude, d.latitude, d.altitudeKm * 10],
      getRadius: (d) => (d.id === selectedSatId ? 24 : 12),
      getFillColor: (d) => {
        if (d.id === selectedSatId) return [0, 255, 255, 180];
        if (d.category === 'Space Station') return [0, 240, 255, 140];
        if (d.category === 'Science & Weather') return [16, 185, 129, 120];
        if (d.category === 'Navigation') return [168, 85, 247, 120];
        if (d.category === 'Communications') return [245, 158, 11, 110];
        return [59, 130, 246, 100];
      },
    })
  );

  // 3. Crisp core point layer (Pickable)
  layers.push(
    new ScatterplotLayer<CalculatedSatellitePosition>({
      id: 'satellite-core',
      data: filtered,
      pickable: true,
      opacity: 1,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 3.5,
      radiusMaxPixels: 10,
      lineWidthMinPixels: 1,
      getPosition: (d) => [d.longitude, d.latitude, d.altitudeKm * 10],
      getRadius: (d) => (d.id === selectedSatId ? 8 : 4.5),
      getFillColor: (d) => {
        if (d.id === selectedSatId) return [255, 255, 255, 255];
        if (d.category === 'Space Station') return [0, 240, 255, 255];
        if (d.category === 'Science & Weather') return [52, 211, 153, 255];
        if (d.category === 'Navigation') return [192, 132, 252, 255];
        if (d.category === 'Communications') return [251, 191, 36, 255];
        return [96, 165, 250, 255];
      },
      getLineColor: (d) => (d.id === selectedSatId ? [0, 240, 255, 255] : [10, 15, 25, 200]),
      onClick: (info) => {
        if (info.object) {
          onSelectSatellite(info.object);
        }
      },
    })
  );

  return layers;
}
