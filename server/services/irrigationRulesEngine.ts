import { cache } from '../redisClient.ts';
import type { FieldParcelFeature, IoTSensorNode } from '../../src/types/hasad.ts';
import type {
  IrrigationRuleConfig,
  ParcelStressAlert,
  YieldImpactPrediction,
} from '../../src/types/irrigation.ts';

const CACHE_ALERTS_KEY = 'hasad:irrigation:active_alerts';

export const DEFAULT_CONFIG: IrrigationRuleConfig = {
  rootZoneMoistureThresholdVwc: 18.0, // < 18% VWC
  ambientAirTempThresholdC: 32.0,      // > 32°C
  canopyTempAnomalyThresholdC: 2.5,   // > +2.5°C canopy anomaly
  criticalStressWindowHours: 24,
};

// Economic value estimations per crop type (metric tons/ha and USD/ton)
const CROP_ECONOMICS: Record<string, { tonsPerHa: number; usdPerTon: number; sensitivity: number }> = {
  'Organic Alfalfa': { tonsPerHa: 14.5, usdPerTon: 320, sensitivity: 1.15 },
  'Winter Wheat': { tonsPerHa: 7.2, usdPerTon: 290, sensitivity: 0.95 },
  'Silage Maize': { tonsPerHa: 22.0, usdPerTon: 180, sensitivity: 1.35 },
  'Desert Barley': { tonsPerHa: 6.8, usdPerTon: 240, sensitivity: 0.85 },
  'Rhodes Grass': { tonsPerHa: 16.0, usdPerTon: 210, sensitivity: 0.90 },
  'Fodder Sorghum': { tonsPerHa: 18.5, usdPerTon: 200, sensitivity: 1.05 },
  'Almonds (Drip Automated)': { tonsPerHa: 3.2, usdPerTon: 4800, sensitivity: 1.40 },
  'Wine Grapes (VSP Trellis)': { tonsPerHa: 8.5, usdPerTon: 1950, sensitivity: 1.10 },
  'Navel Oranges': { tonsPerHa: 28.0, usdPerTon: 750, sensitivity: 1.25 },
  'SHD Picual Olive Groves': { tonsPerHa: 9.0, usdPerTon: 1600, sensitivity: 0.80 },
};

export class IrrigationRulesEngine {
  private config: IrrigationRuleConfig = { ...DEFAULT_CONFIG };
  private activeAlerts: Map<string, ParcelStressAlert> = new Map();
  private dismissedAlertIds: Set<string> = new Set();

  constructor() {
    this.loadAlertsFromCache();
  }

  private async loadAlertsFromCache() {
    try {
      const raw = await cache.get(CACHE_ALERTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as ParcelStressAlert[];
        for (const a of parsed) {
          if (!this.dismissedAlertIds.has(a.id)) {
            this.activeAlerts.set(a.id, a);
          }
        }
      }
    } catch {}
  }

  private async persistAlerts() {
    const list = Array.from(this.activeAlerts.values());
    try {
      await cache.set(CACHE_ALERTS_KEY, JSON.stringify(list), 'EX', 1800);
      await cache.publish('channel:hasad:hydration_alerts', JSON.stringify(list));
    } catch {}
  }

  public updateConfig(newConfig: Partial<IrrigationRuleConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): IrrigationRuleConfig {
    return { ...this.config };
  }

  /**
   * Calculates scientific yield impact prediction based on untreated soil deficit
   */
  private calculateYieldImpact(
    cropType: string,
    areaHectares: number,
    moistureVwc: number,
    ambientTempC: number
  ): YieldImpactPrediction {
    const cropInfo = CROP_ECONOMICS[cropType] || { tonsPerHa: 10.0, usdPerTon: 300, sensitivity: 1.0 };
    const moistureDeficit = Math.max(0, this.config.rootZoneMoistureThresholdVwc - moistureVwc);
    const thermalExcess = Math.max(0, ambientTempC - this.config.ambientAirTempThresholdC);

    // Moisture deficit exerts exponential cellular stress during high thermal loads
    const rawLossPct = (moistureDeficit * 3.6 + thermalExcess * 2.1) * cropInfo.sensitivity;
    const estimatedLossPct = parseFloat(Math.min(46.0, Math.max(12.5, rawLossPct)).toFixed(1));

    // Economic calculation
    const totalPotentialYieldTons = areaHectares * cropInfo.tonsPerHa;
    const lostTons = totalPotentialYieldTons * (estimatedLossPct / 100);
    const economicLossEstUsd = Math.round(lostTons * cropInfo.usdPerTon);

    let riskFactor: YieldImpactPrediction['riskFactor'] = 'STOMATAL_CLOSURE_COLLAPSE';
    if (moistureVwc < 14.5 || thermalExcess > 4.0) {
      riskFactor = 'DESERT_DESICCATION_BURNOUT';
    } else if (moistureVwc < 16.5) {
      riskFactor = 'SEVERE_CELLULAR_PLASMOLYSIS';
    }

    const description = `${cropType} experiencing critical hydraulic conductivity reduction. Projected ${estimatedLossPct}% yield degradation within 24h window without solenoid actuation.`;

    return {
      estimatedLossPct,
      economicLossEstUsd,
      untreatedHoursWindow: 24,
      recoveryWindowHours: 36,
      riskFactor,
      description,
    };
  }

  /**
   * Continuous Threshold Rule Processing Pipeline:
   * Evaluates parcel sensor state against the dual criteria:
   * 1. Root Zone Soil Moisture (20cm) < 18.0% VWC
   * 2. Ambient Microclimate Air Temp > 32.0°C (or Canopy Temp Anomaly > +2.5°C)
   */
  public evaluateParcel(
    parcel: FieldParcelFeature,
    sensors: IoTSensorNode[]
  ): ParcelStressAlert | null {
    // Look up sensors corresponding to this parcel
    const parcelSensors = sensors.filter((s) => s.parcelId === parcel.id);
    const probe = parcelSensors.find((s) => s.nodeType === 'soil_probe') || parcelSensors[0];
    const valve = parcelSensors.find((s) => s.nodeType === 'irrigation_valve') || parcelSensors[0];

    const currentMoisture = probe ? probe.soilMoisture20cm : parcel.properties.soilMoisturePct;
    const ambientTemp = parcel.properties.weatherSummary?.ambientTempC ?? 32.5;
    const soilTemp = probe ? probe.temperatureC : parcel.properties.soilTempC;
    const canopyAnomaly = Math.max(0, soilTemp - 24.0); // Baseline anomaly calculation

    // Dual rule threshold evaluation
    const isMoistureCritical = currentMoisture < this.config.rootZoneMoistureThresholdVwc;
    const isThermalCritical =
      ambientTemp > this.config.ambientAirTempThresholdC ||
      canopyAnomaly >= this.config.canopyTempAnomalyThresholdC;

    const alertId = `alert-${parcel.id}`;

    // If parcel is already actively irrigating and moisture is recovering, clear or suppress alert
    if (parcel.properties.irrigationStatus === 'active' || (valve && (valve.valveState === 'open' || valve.valveState === 'flow_pulsing'))) {
      if (currentMoisture >= 19.5) {
        this.activeAlerts.delete(alertId);
        return null;
      }
    }

    if (isMoistureCritical && isThermalCritical) {
      if (this.dismissedAlertIds.has(alertId)) {
        return null;
      }

      const coords = parcel.geometry.coordinates[0];
      const avgLng = coords.reduce((acc, c) => acc + c[0], 0) / coords.length;
      const avgLat = coords.reduce((acc, c) => acc + c[1], 0) / coords.length;

      const yieldImpact = this.calculateYieldImpact(
        parcel.properties.cropType,
        parcel.properties.areaHectares,
        currentMoisture,
        ambientTemp
      );

      const alert: ParcelStressAlert = {
        id: alertId,
        parcelId: parcel.id,
        parcelName: parcel.properties.name,
        cropType: parcel.properties.cropType,
        sector: parcel.properties.sector,
        coordinates: [parseFloat(avgLng.toFixed(5)), parseFloat(avgLat.toFixed(5))],
        areaHectares: parcel.properties.areaHectares,
        soilMoisturePct: currentMoisture,
        soilTempC: soilTemp,
        ambientTempC: ambientTemp,
        canopyAnomalyC: parseFloat(canopyAnomaly.toFixed(1)),
        severity: 'CRITICAL_HYDRATION_ALERT',
        recommendedAction: `Open solenoid valve (${valve?.id || 'V-01'}) immediately for 30m cycle to avert ${yieldImpact.estimatedLossPct}% yield deficit.`,
        defaultValveId: valve ? valve.id : `actuator-${parcel.id}-02`,
        valveState: valve ? valve.valveState : 'closed',
        flowRateLpm: valve ? valve.flowRateLpm : 0,
        yieldImpact,
        triggeredAt: this.activeAlerts.get(alertId)?.triggeredAt || Date.now(),
      };

      this.activeAlerts.set(alertId, alert);
      return alert;
    } else {
      // Clear alert if criteria no longer met
      this.activeAlerts.delete(alertId);
      return null;
    }
  }

  /**
   * Evaluates all parcels and returns active critical hydration alerts
   */
  public evaluateAll(
    parcels: FieldParcelFeature[],
    sensors: IoTSensorNode[]
  ): ParcelStressAlert[] {
    const list: ParcelStressAlert[] = [];
    for (const p of parcels) {
      const alert = this.evaluateParcel(p, sensors);
      if (alert) {
        list.push(alert);
      }
    }
    this.persistAlerts();
    return list;
  }

  public getActiveAlerts(): ParcelStressAlert[] {
    return Array.from(this.activeAlerts.values()).filter((a) => !this.dismissedAlertIds.has(a.id));
  }

  public dismissAlert(alertId: string): boolean {
    this.dismissedAlertIds.add(alertId);
    this.activeAlerts.delete(alertId);
    this.persistAlerts();
    return true;
  }

  public clearAlertForParcel(parcelId: string) {
    const alertId = `alert-${parcelId}`;
    this.activeAlerts.delete(alertId);
    this.persistAlerts();
  }
}

export const irrigationRulesEngine = new IrrigationRulesEngine();
