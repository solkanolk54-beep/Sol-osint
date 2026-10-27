import { Router, Request, Response } from 'express';
import { cache } from '../redisClient.ts';
import { satelliteService } from '../services/satelliteService.ts';
import { earthquakeService } from '../services/earthquakeService.ts';
import { telemetryService } from '../services/telemetryService.ts';
import { weatherService } from '../services/weatherService.ts';
import { hasadService } from '../services/hasadService.ts';
import { irrigationRulesEngine } from '../services/irrigationRulesEngine.ts';

export const sseRouter = Router();

interface ClientConnection {
  id: string;
  res: Response;
  channel: string;
}

const activeClients = new Map<string, ClientConnection>();

// Send SSE formatted message
function sendSSE(res: Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Global 15-second heartbeat ping
setInterval(() => {
  const pingPayload = { timestamp: Date.now(), clientCount: activeClients.size };
  for (const client of activeClients.values()) {
    try {
      sendSSE(client.res, 'ping', pingPayload);
    } catch (err) {
      activeClients.delete(client.id);
    }
  }
}, 15000);

// Subscribe to internal pub/sub channels
cache.subscribe('channel:incidents', (message) => {
  try {
    const data = JSON.parse(message);
    broadcastToChannel('incidents', 'incidents_update', data);
    broadcastToChannel('earthquakes', 'earthquake_update', data);
    broadcastToChannel('all', 'incidents_update', data);
  } catch (err) {
    console.error('[SSE] Incident pubsub error:', err);
  }
});

cache.subscribe('channel:satellites', (message) => {
  try {
    const data = JSON.parse(message);
    broadcastToChannel('satellites', 'satellite_refresh', data);
    broadcastToChannel('all', 'satellite_refresh', data);
  } catch (err) {
    console.error('[SSE] Satellite pubsub error:', err);
  }
});

export function broadcastToChannel(channel: string, event: string, data: any) {
  for (const client of activeClients.values()) {
    if (client.channel === 'all' || client.channel === channel) {
      try {
        sendSSE(client.res, event, data);
      } catch {
        activeClients.delete(client.id);
      }
    }
  }
}

// Background tick to broadcast dynamic updates (earthquakes, telemetry)
setInterval(async () => {
  if (activeClients.size === 0) return;

  try {
    const [telemetry, terminator] = await Promise.all([
      telemetryService.getCombinedTelemetry(),
      weatherService.getCachedTerminator(),
    ]);

    const currentSensors = hasadService.getSensors();
    const currentParcels = hasadService.getParcels();
    const hydrationAlerts = irrigationRulesEngine.evaluateAll(currentParcels.features, currentSensors);

    broadcastToChannel('telemetry', 'telemetry_batch', telemetry);
    broadcastToChannel('all', 'telemetry_batch', telemetry);
    broadcastToChannel('all', 'terminator_update', terminator);
    broadcastToChannel('all', 'hasad_sensors_update', currentSensors);
    broadcastToChannel('all', 'hydration_alerts_update', hydrationAlerts);
    broadcastToChannel('hasad-telemetry', 'hasad_sensors_update', currentSensors);
    broadcastToChannel('hasad-telemetry', 'hydration_alerts_update', hydrationAlerts);
  } catch (err) {
    // Non-fatal
  }
}, 8000); // 8-second high-rate telemetry broadcast

// Route: /api/stream/:channel?
sseRouter.get('/:channel?', async (req: Request, res: Response) => {
  const channel = (req.params.channel || (req.query.channel as string) || 'all').toLowerCase();
  const clientId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  activeClients.set(clientId, { id: clientId, res, channel });
  console.log(`[SSE] Client connected: ${clientId} on channel [${channel}] (Total: ${activeClients.size})`);

  // Send initial handshake
  sendSSE(res, 'connected', {
    clientId,
    channel,
    timestamp: Date.now(),
    message: 'Telemetry stream established with Osiris Core',
  });

  // Push immediate snapshot based on channel
  try {
    if (channel === 'all' || channel === 'satellites') {
      const satellites = await satelliteService.getSatellites();
      sendSSE(res, 'satellites_init', { count: satellites.length, items: satellites });
    }

    if (channel === 'all' || channel === 'earthquakes' || channel === 'incidents') {
      const eqFeed = await earthquakeService.fetchEarthquakes();
      const weatherIncidents = weatherService.getWeatherIncidents();
      sendSSE(res, 'earthquakes_init', eqFeed);
      sendSSE(res, 'weather_incidents', weatherIncidents);
    }

    if (channel === 'all' || channel === 'telemetry') {
      const telemetry = await telemetryService.getCombinedTelemetry();
      sendSSE(res, 'telemetry_init', telemetry);
    }

    if (channel === 'all' || channel === 'terminator') {
      const terminator = await weatherService.getCachedTerminator();
      sendSSE(res, 'terminator_init', terminator);
    }

    if (channel === 'all' || channel === 'hasad' || channel === 'hasad-telemetry') {
      sendSSE(res, 'hasad_parcels_init', hasadService.getParcels());
      sendSSE(res, 'hasad_sensors_init', hasadService.getSensors());
      sendSSE(res, 'hydration_alerts_init', irrigationRulesEngine.getActiveAlerts());
      try {
        const radar = await hasadService.getRainViewerRadar();
        sendSSE(res, 'hasad_radar_init', radar);
      } catch {}
    }
  } catch (err) {
    console.error('[SSE] Error sending initial payload:', err);
  }

  req.on('close', () => {
    activeClients.delete(clientId);
    console.log(`[SSE] Client disconnected: ${clientId} (Remaining: ${activeClients.size})`);
  });
});
