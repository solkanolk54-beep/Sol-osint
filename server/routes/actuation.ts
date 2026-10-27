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
