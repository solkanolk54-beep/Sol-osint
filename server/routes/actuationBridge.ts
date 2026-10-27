import { Router, Request, Response } from 'express';
import { cache } from '../redisClient.ts';
import { hasadService } from '../services/hasadService.ts';
import { broadcastToChannel } from './sse.ts';

export const actuationBridgeRouter = Router();

const REDIS_BRIDGE_NODE_PREFIX = 'hasad:hardware:node:';

interface ValveStatusAckPayload {
  nodeId: string;
  valveId?: string;
  parcelId?: string;
  state: 'OPEN' | 'CLOSED' | 'PULSING' | 'ERROR';
  batteryVoltage?: number; // e.g. 3.28V (LiFePO4)
  batteryPct?: number;     // e.g. 94%
  rssiDbm?: number;        // e.g. -68 dBm
  flowRateLpm?: number;    // e.g. 175.2 L/min
  pulseElapsedSeconds?: number;
  firmwareVersion?: string;
  uptimeSeconds?: number;
}

/**
 * GET /api/hasad/get-valve-command?nodeId=...
 * Polled periodically (every 5-15s) by ESP32 field nodes to retrieve desired valve state
 */
actuationBridgeRouter.get('/get-valve-command', async (req: Request, res: Response) => {
  try {
    const nodeId = (req.query.nodeId as string) || '';
    if (!nodeId) {
      return res.status(400).json({ error: 'nodeId query parameter is required' });
    }

    const sensors = hasadService.getSensors();
    // Match by node ID or substring (e.g. "SA-AK-03")
    const matchedSensor = sensors.find((s) => s.id === nodeId || nodeId.includes(s.parcelId));

    let command: 'OPEN' | 'CLOSE' = 'CLOSE';
    let durationMinutes = 30;
    let targetFlowRateLpm = 0;
    let valveId = `valve-${nodeId}`;

    if (matchedSensor) {
      valveId = matchedSensor.id;
      const isOpen = matchedSensor.valveState === 'open' || matchedSensor.valveState === 'flow_pulsing';
      command = isOpen ? 'OPEN' : 'CLOSE';
      targetFlowRateLpm = isOpen ? (matchedSensor.flowRateLpm || 175.0) : 0;
    }

    // Check if there is an explicit override in cache
    const cachedCommand = await cache.get(`${REDIS_BRIDGE_NODE_PREFIX}${nodeId}:cmd`);
    if (cachedCommand) {
      try {
        const parsed = JSON.parse(cachedCommand);
        command = parsed.action;
        durationMinutes = parsed.durationMinutes || 30;
      } catch {}
    }

    const responsePayload = {
      status: 'ok',
      nodeId,
      valveId,
      command, // "OPEN" or "CLOSE"
      pulseDurationMinutes: durationMinutes,
      maxPulseSeconds: durationMinutes * 60,
      targetFlowRateLpm,
      pollIntervalSeconds: 10,
      serverTimestamp: Date.now(),
      protocol: 'HASAD-ESP32-BRIDGE-V2',
    };

    return res.json(responsePayload);
  } catch (err: any) {
    console.error('[ESP32 Bridge Error]', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/hasad/valve-status-ack
 * Receives execution acknowledgment and telemetry from physical ESP32 devices
 */
actuationBridgeRouter.post('/valve-status-ack', async (req: Request, res: Response) => {
  try {
    const payload = req.body as ValveStatusAckPayload;
    const { nodeId, state, batteryVoltage, batteryPct, rssiDbm, flowRateLpm, firmwareVersion } = payload;

    if (!nodeId || !state) {
      return res.status(400).json({ error: 'nodeId and state are required' });
    }

    const now = Date.now();
    const isActuated = state === 'OPEN' || state === 'PULSING';

    // Update sensor node in hasadService if present
    const sensors = hasadService.getSensors();
    const sensor = sensors.find((s) => s.id === nodeId || nodeId.includes(s.parcelId));

    if (sensor) {
      sensor.valveState = isActuated ? 'flow_pulsing' : 'closed';
      sensor.flowRateLpm = isActuated ? (flowRateLpm || 175.0) : 0;
      if (batteryPct !== undefined) sensor.batteryPct = batteryPct;
      if (rssiDbm !== undefined) sensor.signalDbm = rssiDbm;
      sensor.lastPing = now;
    }

    // Cache latest hardware ping in Redis / in-memory store
    const hardwareRecord = {
      ...payload,
      lastAckTimestamp: now,
      online: true,
    };

    await cache.set(
      `${REDIS_BRIDGE_NODE_PREFIX}${nodeId}:status`,
      JSON.stringify(hardwareRecord),
      'EX',
      300
    );

    // Broadcast updated telemetry over SSE
    broadcastToChannel('hasad', 'hasad_sensors_update', hasadService.getSensors());
    broadcastToChannel('all', 'hasad_sensors_update', hasadService.getSensors());

    return res.json({
      success: true,
      acknowledged: true,
      nodeId,
      state,
      nextPollIntervalSeconds: 10,
      timestamp: now,
    });
  } catch (err: any) {
    console.error('[ESP32 Ack Error]', err);
    return res.status(500).json({ error: err.message });
  }
});
