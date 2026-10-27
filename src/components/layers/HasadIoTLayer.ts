import { ScatterplotLayer } from '@deck.gl/layers';
import type { IoTSensorNode } from '../../types/hasad.ts';

export interface HasadIoTLayerProps {
  sensors: IoTSensorNode[];
  selectedSensorId: string | null;
  visible: boolean;
  pulsePhase: number; // 0.0 to 1.0 from animation loop
  onSelectSensor: (sensor: IoTSensorNode) => void;
}

export function createHasadIoTLayer(props: HasadIoTLayerProps) {
  const { sensors, selectedSensorId, visible, pulsePhase, onSelectSensor } = props;

  if (!visible || !sensors.length) {
    return [];
  }

  const layers: any[] = [];

  // Active or Alert Sensors that should pulse with shockwave ring
  const pulsingSensors = sensors.filter(
    (s) => s.alertActive || s.valveState === 'flow_pulsing' || s.valveState === 'open' || s.id === selectedSensorId
  );

  if (pulsingSensors.length > 0) {
    layers.push(
      new ScatterplotLayer<IoTSensorNode>({
        id: 'hasad-iot-pulse-rings',
        data: pulsingSensors,
        pickable: false,
        stroked: true,
        filled: false,
        radiusScale: 1,
        radiusMinPixels: 6,
        radiusMaxPixels: 38,
        lineWidthMinPixels: 1.5,
        getPosition: (d) => [d.coordinates[0], d.coordinates[1], 15],
        getRadius: (d) => {
          const isSelected = d.id === selectedSensorId;
          const base = isSelected ? 45 : 30;
          return base * (0.4 + pulsePhase * 1.0);
        },
        getLineColor: (d) => {
          const alpha = Math.max(0, Math.floor((1 - pulsePhase) * 230));
          if (d.alertActive) {
            return [239, 68, 68, alpha]; // Red alert pulse
          }
          if (d.valveState === 'flow_pulsing' || d.valveState === 'open') {
            return [34, 197, 94, alpha]; // Green irrigation cycle pulse
          }
          return [0, 240, 255, alpha]; // Cyan selection pulse
        },
      })
    );
  }

  // Core Solid Sensor Markers
  layers.push(
    new ScatterplotLayer<IoTSensorNode>({
      id: 'hasad-iot-sensor-cores',
      data: sensors,
      pickable: true,
      stroked: true,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 4,
      radiusMaxPixels: 11,
      lineWidthMinPixels: 1.5,
      getPosition: (d) => [d.coordinates[0], d.coordinates[1], 15],
      getRadius: (d) => (d.id === selectedSensorId ? 11 : 6),
      getFillColor: (d) => {
        if (d.id === selectedSensorId) {
          return [255, 255, 255, 255];
        }
        if (d.alertActive) {
          return [239, 68, 68, 240]; // Alert Red
        }
        if (d.nodeType === 'irrigation_valve') {
          return d.valveState === 'flow_pulsing' || d.valveState === 'open'
            ? [34, 197, 94, 240] // Active flow (Green)
            : [148, 163, 184, 220]; // Idle valve (Slate)
        }
        if (d.nodeType === 'soil_probe') {
          return [14, 165, 233, 240]; // Sky Blue soil probe
        }
        return [234, 179, 8, 240]; // Amber weather station / dendrometer
      },
      getLineColor: (d) => {
        if (d.id === selectedSensorId) {
          return [0, 240, 255, 255];
        }
        return [15, 23, 42, 220];
      },
      onClick: (info) => {
        if (info.object) {
          onSelectSensor(info.object as IoTSensorNode);
        }
      },
    })
  );

  return layers;
}
