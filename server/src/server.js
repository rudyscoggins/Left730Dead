/**
 * Express & WebSocket Server for Left 730 Dead
 */

import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GameEngine } from './game/GameEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const clientPublicPath = path.resolve(__dirname, '../../client/public');

export function createServer(port = 7300) {
  const app = express();
  app.use(express.json());
  app.use(express.static(clientPublicPath));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api')) {
      return res.sendFile(path.join(clientPublicPath, 'index.html'));
    }
    next();
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });
  const engine = new GameEngine({ tps: 25 });

  // Broadcast helper
  function broadcast(data) {
    const payload = typeof data === 'string' ? data : JSON.stringify(data);
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  engine.setBroadcastCallback((data) => {
    broadcast(data);
  });

  // REST API Routes
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      uptime: process.uptime(),
      tps: engine.tps,
      wave: engine.wave,
      inGameTime: engine.getInGameTime(engine.wave),
      winStreak: engine.winStreak,
      endlessMode: engine.endlessMode,
      survivors: engine.survivors.length,
      zombies: engine.zombies.length,
      clientsConnected: wss.clients.size
    });
  });

  app.get('/api/map', (req, res) => {
    res.json(engine.map.toJSON());
  });

  // Bot Ingestion Webhook for Phase 2 readiness
  app.post('/api/bot/voice_update', (req, res) => {
    const { action, discordId, displayName, avatarUrl, color } = req.body;
    if (!discordId) {
      return res.status(400).json({ error: 'Missing discordId in payload' });
    }
    if (action === 'join') {
      const survivor = engine.addSurvivor(displayName || 'Discord Survivor', discordId, color, avatarUrl);
      return res.json({ success: true, action: 'joined', survivor: survivor.toJSON() });
    } else if (action === 'leave') {
      const removed = engine.removeSurvivor(String(discordId));
      return res.json({ success: true, action: 'left', removed });
    }
    res.status(400).json({ error: 'Invalid action, expected "join" or "leave"' });
  });

  app.post('/api/bot/command', (req, res) => {
    const { discordId, command } = req.body;
    if (!discordId || !command) {
      return res.status(400).json({ error: 'Missing discordId or command in payload' });
    }
    const survivor = engine.survivors.find(s => s.discordId === String(discordId) || s.id === String(discordId));
    if (!survivor) {
      return res.status(404).json({ error: 'Survivor not found for discordId', discordId });
    }
    engine.queueCommand(survivor.id, command);
    res.json({ success: true, queuedFor: survivor.name, command });
  });

  // WebSocket Connection Handling
  wss.on('connection', (ws) => {
    // Send initial Map and state immediately
    ws.send(JSON.stringify({
      type: 'INIT_MAP',
      map: engine.map.toJSON()
    }));

    ws.send(JSON.stringify(engine.getSnapshot()));

    ws.on('message', (message) => {
      try {
        const msg = JSON.parse(message.toString());
        handleClientMessage(msg, ws);
      } catch (err) {
        console.error('[WS] Failed to parse message:', err);
      }
    });

    ws.on('error', (err) => {
      console.warn('[WS] Client error:', err.message);
    });
  });

  function handleClientMessage(msg, ws) {
    switch (msg.type) {
      case 'GET_MAP':
        ws.send(JSON.stringify({ type: 'INIT_MAP', map: engine.map.toJSON() }));
        break;

      case 'ADD_SURVIVOR':
        engine.addSurvivor(msg.name, msg.discordId, msg.color);
        break;

      case 'REMOVE_SURVIVOR':
        engine.removeSurvivor(msg.id);
        break;

      case 'SPAWN_WAVE':
        engine.startWave(msg.wave || engine.wave);
        break;

      case 'SPAWN_ZOMBIE':
        engine.spawnZombie(msg.zombieType);
        break;

      case 'DAMAGE_BARRICADE':
        engine.damageBarricade(msg.barricadeId, msg.damage || 25);
        break;

      case 'REPAIR_BARRICADE':
        const b = engine.barricades.find(x => x.id === msg.barricadeId);
        if (b) b.repair(msg.amount || 25);
        break;

      case 'KILL_ZOMBIES':
        engine.killAllZombies();
        break;

      case 'RESET_GAME':
        engine.resetGame();
        break;

      case 'TOGGLE_AUTO_WAVE':
        engine.autoWave = !engine.autoWave;
        break;

      case 'TOGGLE_ENDLESS_MODE':
        engine.setEndlessMode(msg.enabled !== undefined ? msg.enabled : !engine.endlessMode);
        break;

      case 'SEND_COMMAND':
        engine.queueCommand(msg.playerId, msg.command);
        break;

      case 'SELECT_PERK':
        engine.progression.selectPerk(msg.perkId, 'DRIVEN');
        break;

      case 'SET_PERK_MODE':
        engine.progression.setPerkMode(msg.mode);
        break;

      default:
        console.warn('[WS] Unknown message type:', msg.type);
    }
  }

  return {
    app,
    server,
    engine,
    start: () => {
      server.listen(port, '0.0.0.0', () => {
        console.log(`\n==================================================`);
        console.log(`🧟 LEFT 730 DEAD - DUSK TO DAWN SURVIVAL ENGINE`);
        console.log(`==================================================`);
        console.log(`> Engine Tick Rate : ${engine.tps} TPS`);
        console.log(`> Local Web Server : http://localhost:${port}`);
        console.log(`> Stream / LAN URL : http://192.168.86.48:${port}`);
        console.log(`==================================================\n`);
        engine.start();
      });
    }
  };
}
