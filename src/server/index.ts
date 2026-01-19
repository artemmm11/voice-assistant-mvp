import express from 'express';
import http from 'http';
import { WebSocketServer } from 'ws';
import next from 'next';
import rateLimit from 'express-rate-limit';
import { config, validateConfig } from './config';
import { handleConnection } from './ws/session-handler';

validateConfig();

const dev = config.nodeEnv !== 'production';
const nextApp = next({ dev, dir: process.cwd() });
const handle = nextApp.getRequestHandler();

const ipConnections = new Map<string, number>();
const MAX_CONNECTIONS_PER_IP = 3;

async function startServer() {
  await nextApp.prepare();

  const app = express();
  const server = http.createServer(app);

  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: { error: 'Too many requests, please try again later' },
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api', limiter);

  app.get('/health', (_, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.all('*', (req, res) => {
    return handle(req, res);
  });

  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() 
      || req.socket.remoteAddress 
      || 'unknown';

    const currentConnections = ipConnections.get(clientIp) || 0;
    if (currentConnections >= MAX_CONNECTIONS_PER_IP) {
      ws.close(1008, 'Too many connections from this IP');
      return;
    }

    ipConnections.set(clientIp, currentConnections + 1);

    ws.on('close', () => {
      const count = ipConnections.get(clientIp) || 1;
      if (count <= 1) {
        ipConnections.delete(clientIp);
      } else {
        ipConnections.set(clientIp, count - 1);
      }
    });

    handleConnection(ws, clientIp);
  });

  server.listen(config.port, () => {
    console.log(`Server running at http://localhost:${config.port}`);
    console.log(`WebSocket available at ws://localhost:${config.port}/ws`);
    console.log(`Environment: ${config.nodeEnv}`);
  });

  process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    wss.clients.forEach((client) => client.close());
    server.close(() => {
      console.log('Server closed');
      process.exit(0);
    });
  });
}

startServer().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
