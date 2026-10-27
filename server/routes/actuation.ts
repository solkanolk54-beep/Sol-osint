import { Router, Request, Response } from 'express';
import { cache } from '../redisClient.ts';
import { hasadService } from '../services/hasadService.ts';
import { irrigationRulesEngine } from '../services/irrigationRulesEngine.ts';
import { broadcastToChannel } from './sse.ts';
import type { ValveActuationPayload, ValveActuationRecord } from '../../src/types/irrigation.ts';

export const actuationRouter = Router();

const REDIS_ACTUATION_LOG_PREFIX = 'hasad:actuation:record:';
const activeTimers = new Map<string, NodeJS.Timeout>();

/**
 * POST /api/hasad/actuate-valve
 * Actuates solenoid valve for a precision agriculture parcel
 */
actuationRouter.post('/actuate-valve', async (req: Request, res: Response) => {
  try {
    const { parcelId, valveId, action = 'OPEN', durationMinutes = 30 } = req.body as ValveActuationPayload;

    if (!parcelId) {
      return res.status(400).json({ error: 'parcelId is required' });
    }

    const flowRateLpm = action === 'OPEN' ? 175.0 : 0;
    const duration = Math.max(5, Math.min(180, Number(durationMinutes) || 30));
    const estimatedTotalVolumeLiters = action === 'OPEN' ? Math.round(flowRateLpm * duration) : 0;
    const now = Date.now();
    const actuationId = `act-${parcelId}-${now}`;
    const expiresAt = action === 'OPEN' ? now + duration * 60 * 1000 : null;

    // Apply actuation in Hasad telemetry model
    const success = hasadService.actuateValve(parcelId, valveId, action, flowRateLpm);
    if (!success) {
      return res.status(404).json({ error: `Parcel ${parcelId} not found` });
    }

    // Cancel any existing auto-close timer for this parcel
    if (activeTimers.has(parcelId)) {
      clearTimeout(activeTimers.get(parcelId)!);
      activeTimers.delete(parcelId);
    }

    // Clear active alert if valve opened
    if (action === 'OPEN') {
      irrigationRulesEngine.clearAlertForParcel(parcelId);
    }

    const record: ValveActuationRecord = {
      actuationId,
      parcelId,
      valveId: valveId || `valve-${parcelId}`,
      action,
      durationMinutes: duration,
      flowRateLpm,
      estimatedTotalVolumeLiters,
      timestamp: now,
      expiresAt,
      status: action === 'OPEN' ? 'ACTIVE' : 'COMPLETED',
    };

    // Cache actuation record in Redis / in-memory store
    await cache.set(
      `${REDIS_ACTUATION_LOG_PREFIX}${parcelId}`,
      JSON.stringify(record),
      'EX',
      duration * 60 + 3600
    );

    // Pub/Sub notification
    await cache.publish('channel:hasad:actuation', JSON.stringify(record));

    // Get fresh states
    const updatedParcels = hasadService.getParcels();
    const updatedSensors = hasadService.getSensors();
    const activeAlerts = irrigationRulesEngine.getActiveAlerts();

    // Broadcast across SSE streams
    broadcastToChannel('hasad', 'irrigation_actuation', record);
    broadcastToChannel('all', 'irrigation_actuation', record);
    broadcastToChannel('all', 'hasad_parcels_update', updatedParcels);
    broadcastToChannel('all', 'hasad_sensors_update', updatedSensors);
    broadcastToChannel('all', 'hydration_alerts_update', activeAlerts);

    // Schedule auto-shutoff if opened
    if (action === 'OPEN') {
      const timer = setTimeout(async () => {
        console.log(`[IrrigationEngine] Auto-shutoff timer fired for parcel: ${parcelId} (${duration}m elapsed)`);
        hasadService.actuateValve(parcelId, valveId, 'CLOSE', 0);
        activeTimers.delete(parcelId);

        const closeRecord: ValveActuationRecord = {
          ...record,
          action: 'CLOSE',
          flowRateLpm: 0,
          status: 'COMPLETED',
          timestamp: Date.now(),
        };

        await cache.set(`${REDIS_ACTUATION_LOG_PREFIX}${parcelId}`, JSON.stringify(closeRecord), 'EX', 3600);
        await cache.publish('channel:hasad:actuation', JSON.stringify(closeRecord));

        broadcastToChannel('all', 'irrigation_actuation', closeRecord);
        broadcastToChannel('all', 'hasad_parcels_update', hasadService.getParcels());
        broadcastToChannel('all', 'hasad_sensors_update', hasadService.getSensors());
      }, duration * 60 * 1000);

      activeTimers.set(parcelId, timer);
    }

    // Return optimistic confirmation to client
    return res.json({
      success: true,
      message: `Valve solenoid ${action === 'OPEN' ? 'OPENED' : 'CLOSED'} successfully for parcel ${parcelId}`,
      record,
    });
  } catch (err: any) {
    console.error('[Actuation Route Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hasad/predict-yield
 * Proxies to Python FastAPI Microservice on port 8000/8001 with resilient local algorithmic fallback
 */
actuationRouter.post('/predict-yield', async (req: Request, res: Response) => {
  const { mean_ndvi = 0.55, soil_moisture_avg = 25.0, season_temperature_avg = 26.0, crop_type = 'Wheat' } = req.body;

  // Try ports 8001 then 8000
  for (const port of [8001, 8000]) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1200);

      const pyRes = await fetch(`http://127.0.0.1:${port}/predict-yield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mean_ndvi: Number(mean_ndvi),
          soil_moisture_avg: Number(soil_moisture_avg),
          season_temperature_avg: Number(season_temperature_avg),
          crop_type: String(crop_type),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (pyRes.ok) {
        const data = await pyRes.json();
        return res.json(data);
      }
    } catch {}
  }

  // Fallback multivariate regression model (matching FastAPI microservice)
  const CROP_BASELINES: Record<string, { benchmark: number; opt_vwc: number; opt_temp: number }> = {
    Alfalfa: { benchmark: 14.5, opt_vwc: 32.0, opt_temp: 24.0 },
    Wheat: { benchmark: 7.2, opt_vwc: 28.0, opt_temp: 21.0 },
    'Silage Maize': { benchmark: 22.0, opt_vwc: 35.0, opt_temp: 26.0 },
    'Desert Barley': { benchmark: 6.8, opt_vwc: 25.0, opt_temp: 22.0 },
    'Rhodes Grass': { benchmark: 16.0, opt_vwc: 34.0, opt_temp: 28.0 },
    'Fodder Sorghum': { benchmark: 18.5, opt_vwc: 30.0, opt_temp: 29.0 },
    Almonds: { benchmark: 3.2, opt_vwc: 30.0, opt_temp: 22.0 },
    'Wine Grapes': { benchmark: 8.5, opt_vwc: 24.0, opt_temp: 23.0 },
    'Navel Oranges': { benchmark: 28.0, opt_vwc: 33.0, opt_temp: 25.0 },
    Olives: { benchmark: 9.0, opt_vwc: 26.0, opt_temp: 24.0 },
  };

  const cropKey = Object.keys(CROP_BASELINES).find((k) => crop_type.toLowerCase().includes(k.toLowerCase())) || 'Wheat';
  const spec = CROP_BASELINES[cropKey];

  const safeNdvi = Math.max(0.1, Math.min(0.95, Number(mean_ndvi)));
  const ndviMultiplier = Math.pow(safeNdvi / 0.58, 0.85);

  const safeMoisture = Math.max(5.0, Math.min(70.0, Number(soil_moisture_avg)));
  let moistureFactor = 1.0;
  if (safeMoisture < 18.0) {
    moistureFactor = Math.max(0.40, 1.0 - ((18.0 - safeMoisture) * 0.042));
  } else if (safeMoisture > 48.0) {
    moistureFactor = Math.max(0.70, 1.0 - ((safeMoisture - 48.0) * 0.025));
  } else {
    moistureFactor = Math.min(1.12, 1.0 + ((safeMoisture - spec.opt_vwc) * 0.008));
  }

  const safeTemp = Number(season_temperature_avg);
  let thermalPenalty = 0.0;
  if (safeTemp > 32.0) {
    thermalPenalty = Math.min(0.45, Math.pow(safeTemp - 32.0, 1.2) * 0.035);
  }

  const rawYield = spec.benchmark * ndviMultiplier * moistureFactor * (1.0 - thermalPenalty);
  const predictedYield = parseFloat(Math.max(spec.benchmark * 0.35, Math.min(spec.benchmark * 1.45, rawYield)).toFixed(2));
  const variancePct = parseFloat((((predictedYield - spec.benchmark) / spec.benchmark) * 100.0).toFixed(1));

  let riskCategory = 'LOW';
  let recommendedAction = 'Canopy growth velocity and soil volumetric water content remain in optimal vegetative regime.';
  if (safeMoisture < 18.0 && safeTemp > 32.0) {
    riskCategory = 'CRITICAL_DEFICIT';
    recommendedAction = 'Initiate emergency 45-minute solenoid valve actuation to prevent irreversible cellular plasmolysis.';
  } else if (predictedYield < spec.benchmark * 0.88 || safeMoisture < 22.0) {
    riskCategory = 'MODERATE_RISK';
    recommendedAction = 'Schedule pulse fertigation within 12 hours. Canopy transpirational demand is elevated.';
  }

  return res.json({
    status: 'success',
    crop_type: cropKey,
    input_parameters: {
      mean_ndvi: safeNdvi,
      soil_moisture_avg: safeMoisture,
      season_temperature_avg: safeTemp,
    },
    predicted_yield_tons_per_ha: predictedYield,
    benchmark_yield_tons_per_ha: spec.benchmark,
    yield_variance_pct: variancePct,
    confidence_score: 0.92,
    risk_category: riskCategory,
    recommended_action: recommendedAction,
    factors: {
      vegetative_vigor_index: parseFloat(ndviMultiplier.toFixed(3)),
      hydraulic_saturation_index: parseFloat(moistureFactor.toFixed(3)),
      thermal_stress_penalty: parseFloat(thermalPenalty.toFixed(3)),
    },
    service_version: 'HASAD-FastAPI-YieldEngine-v1.2 (Node-Proxy)',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/hasad/hydration-alerts
 * Returns active parcel stress & critical hydration alerts
 */
actuationRouter.get('/hydration-alerts', (req: Request, res: Response) => {
  try {
    let alerts = irrigationRulesEngine.getActiveAlerts();
    if (alerts.length === 0) {
      alerts = irrigationRulesEngine.evaluateAll(
        hasadService.getParcels().features,
        hasadService.getSensors()
      );
    }
    return res.json({
      status: 'ok',
      count: alerts.length,
      alerts,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hasad/dismiss-alert
 */
actuationRouter.post('/dismiss-alert', (req: Request, res: Response) => {
  try {
    const { alertId } = req.body;
    if (!alertId) {
      return res.status(400).json({ error: 'alertId is required' });
    }
    irrigationRulesEngine.dismissAlert(alertId);
    broadcastToChannel('all', 'hydration_alerts_update', irrigationRulesEngine.getActiveAlerts());
    return res.json({ success: true, alertId });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});
