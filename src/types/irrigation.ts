export interface IrrigationRuleConfig {
  rootZoneMoistureThresholdVwc: number; // default: 18.0 (%)
  ambientAirTempThresholdC: number;     // default: 32.0 (°C)
  canopyTempAnomalyThresholdC: number;  // default: 2.5 (°C)
  criticalStressWindowHours: number;    // default: 24 (hours)
}

export interface YieldImpactPrediction {
  estimatedLossPct: number;             // e.g. 26.4 (%)
  economicLossEstUsd: number;          // e.g. 14200 ($)
  untreatedHoursWindow: number;        // e.g. 24
  recoveryWindowHours: number;         // e.g. 48
  riskFactor:
    | 'SEVERE_CELLULAR_PLASMOLYSIS'
    | 'STOMATAL_CLOSURE_COLLAPSE'
    | 'DESERT_DESICCATION_BURNOUT';
  description: string;
}

export interface ParcelStressAlert {
  id: string;
  parcelId: string;
  parcelName: string;
  cropType: string;
  sector: string;
  coordinates: [number, number]; // [lng, lat]
  areaHectares: number;
  soilMoisturePct: number;
  soilTempC: number;
  ambientTempC: number;
  canopyAnomalyC: number;
  severity: 'CRITICAL_HYDRATION_ALERT' | 'HIGH_STRESS_WARNING' | 'ELEVATED_VAPOR_PRESSURE_DEFICIT';
  recommendedAction: string;
  defaultValveId: string;
  valveState: 'open' | 'closed' | 'flow_pulsing';
  flowRateLpm: number;
  yieldImpact: YieldImpactPrediction;
  triggeredAt: number;
  dismissed?: boolean;
}

export interface ValveActuationPayload {
  parcelId: string;
  valveId?: string;
  action: 'OPEN' | 'CLOSE';
  durationMinutes: number; // 15, 30, 45, 60, etc.
}

export interface ValveActuationRecord {
  actuationId: string;
  parcelId: string;
  valveId: string;
  action: 'OPEN' | 'CLOSE';
  durationMinutes: number;
  flowRateLpm: number;
  estimatedTotalVolumeLiters: number;
  timestamp: number;
  expiresAt: number | null;
  status: 'CONFIRMED' | 'ACTIVE' | 'COMPLETED';
}
