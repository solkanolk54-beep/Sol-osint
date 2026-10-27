import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { satelliteService } from './server/services/satelliteService.ts';
import { earthquakeService } from './server/services/earthquakeService.ts';
import { weatherService } from './server/services/weatherService.ts';
import { telemetryService } from './server/services/telemetryService.ts';
import { hasadService } from './server/services/hasadService.ts';
import { sseRouter } from './server/routes/sse.ts';
import { actuationRouter } from './server/routes/actuation.ts';
import { cache } from './server/redisClient.ts';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const isProd = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

// Explicit static serving for MapLibre worker scripts to guarantee availability
app.get(['/maplibre-gl-worker.mjs', '/assets/maplibre-gl-worker.mjs'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.resolve(__dirname, 'node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs'));
});

app.get(['/maplibre-gl-shared.mjs', '/assets/maplibre-gl-shared.mjs'], (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/javascript');
  res.sendFile(path.resolve(__dirname, 'node_modules/maplibre-gl/dist/maplibre-gl-shared.mjs'));
});

app.use(express.static(path.resolve(__dirname, 'public')));

// API Routes
app.use('/api/stream', sseRouter);

app.get('/api/satellites', async (req: Request, res: Response) => {
  try {
    const satellites = await satelliteService.getSatellites();
    res.json({
      status: 'ok',
      count: satellites.length,
      timestamp: Date.now(),
      data: satellites,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/earthquakes', async (req: Request, res: Response) => {
  try {
    const feed = await earthquakeService.fetchEarthquakes();
    res.json(feed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/telemetry', async (req: Request, res: Response) => {
  try {
    const feed = await telemetryService.getCombinedTelemetry();
    res.json(feed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/geo/sun-terminator', (req: Request, res: Response) => {
  try {
    const timestamp = req.query.timestamp ? new Date(req.query.timestamp as string) : new Date();
    const terminator = weatherService.generateSolarTerminator(timestamp);
    res.json(terminator);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/incidents', async (req: Request, res: Response) => {
  try {
    const [eqFeed, weatherIncidents] = await Promise.all([
      earthquakeService.fetchEarthquakes(),
      Promise.resolve(weatherService.getWeatherIncidents()),
    ]);
    res.json({
      timestamp: Date.now(),
      earthquakes: eqFeed,
      weather: weatherIncidents,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// HASAD AgriTech & Predictive Actuation Routes
app.use('/api/hasad', actuationRouter);

app.get('/api/hasad/parcels', (req: Request, res: Response) => {
  try {
    res.json(hasadService.getParcels());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hasad/sensors', (req: Request, res: Response) => {
  try {
    res.json(hasadService.getSensors());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hasad/weather-radar', async (req: Request, res: Response) => {
  try {
    const radar = await hasadService.getRainViewerRadar();
    res.json(radar);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/hasad/hubs', (req: Request, res: Response) => {
  res.json(hasadService.getHubs());
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: Date.now(),
    redis: cache.isRedisConnected() ? 'connected' : 'memory_fallback',
  });
});

// Start background polling loops
earthquakeService.startPolling(60000); // 60s
satelliteService.fetchAndCacheSatellites().catch(console.error);

async function startServer() {
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('[Server] Vite middleware mounted in dev mode');
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
    console.log('[Server] Serving production static files from dist');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Osiris Engine] Core telemetry server active on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[Server] Fatal startup error:', err);
  process.exit(1);
});
