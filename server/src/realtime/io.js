'use strict';

const { Server } = require('socket.io');
const presenceStore = require('./presenceStore');
const { setupRedisAdapter } = require('./redisAdapter');
const cacheService = require('../cache/cacheService');
const cacheKeys = require('../cache/keys');

let io = null;

const clients = new Map();

const raceRooms = new Map();

const usernameCache = new Map();

const USERNAME_TTL_MS = 60 * 60 * 1000;
const HEARTBEAT_MS = 20 * 1000;
const PRESENCE_CLEANUP_MS = 60 * 1000;

function resolveToken(socket) {
  const raw =
    socket.handshake?.auth?.token ||
    socket.handshake?.query?.token ||
    (socket.handshake?.headers?.authorization?.startsWith('Bearer ')
      ? socket.handshake.headers.authorization.slice(7)
      : null);
  return raw || null;
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/authenticate');
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

async function presenceSummary(raceId = null) {
  return presenceStore.summary(raceId);
}

async function broadcastPresence() {
  try {
    safeEmit('presence:update', await presenceSummary());
  } catch {
  }
}

function safeEmit(event, payload, room = null) {
  if (!io) return false;
  try {
    if (room) io.to(room).emit(event, payload);
    else io.emit(event, payload);
    return true;
  } catch (err) {
    console.error(`[realtime] emit "${event}" failed:`, err.message);
    return false;
  }
}

function init(httpServer) {
  if (io) return io;

  const { ALLOWED_ORIGINS } = require('../middleware/cors');

  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    serveClient: false,
  });

  setupRedisAdapter(io).catch((err) =>
    console.warn(`[realtime] redis adapter setup failed: ${err.message}`),
  );

  const cleanupTimer = setInterval(() => {
    presenceStore.cleanup().catch(() => {});
  }, PRESENCE_CLEANUP_MS);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  io.use((socket, next) => {
    const decoded = verifyToken(resolveToken(socket));
    socket.data.user = decoded
      ? { userId: decoded.id, username: null, email: decoded.email || null, role: decoded.role }
      : null;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user || {};

    const entry = {
      userId: user.userId ?? null,
      username: user.username || 'Гость',
      role: user.role || null,
      raceId: null,
    };
    clients.set(socket.id, entry);
    const registration = presenceStore.register(socket.id, entry).catch(() => {});

    if (user.userId && !user.username) {
      const cached = usernameCache.get(user.userId);
      if (cached) {
        applyUsername(socket, cached);
      } else {
        resolveUsername(user.userId)
          .then((name) => {
            if (name) applyUsername(socket, name);
          })
          .catch((err) => console.warn(`[socket] username lookup failed: ${err.message}`));
      }
    }

    console.log(
      `[socket] connected ${socket.id} (${user.username || 'guest'}) — ${clients.size} online`,
    );

    const heartbeatTimer = setInterval(() => {
      presenceStore.heartbeat(socket.id).catch(() => {});
    }, HEARTBEAT_MS);
    if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

    socket.on('race:join', (payload) => {
      const raceId = payload?.raceId;
      if (raceId == null) return;

      const key = String(raceId);
      socket.join(`race:${key}`);
      const current = clients.get(socket.id);
      if (current) current.raceId = key;

      const set = raceRooms.get(key) || new Set();
      set.add(socket.id);
      raceRooms.set(key, set);

      presenceStore
        .update(socket.id, { raceId: key })
        .then(() => presenceSummary(key))
        .then((summary) => socket.emit('race:presence', { raceId: key, ...summary }))
        .catch(() => {});
    });

    socket.on('race:leave', (payload) => {
      leaveRace(socket, payload?.raceId);
    });

    socket.on('comment:typing', (payload) => {
      const raceId = payload?.raceId;
      if (raceId == null) return;
      const current = clients.get(socket.id) || {};
      socket.broadcast.to(`race:${String(raceId)}`).emit('comment:typing', {
        raceId: String(raceId),
        username: current.username || 'Гость',
        userId: current.userId ?? null,
        at: new Date().toISOString(),
      });
    });

    socket.on('disconnect', async (reason) => {
      clearInterval(heartbeatTimer);
      const current = clients.get(socket.id);
      clients.delete(socket.id);

      if (current?.raceId) {
        try {
          await leaveRace(socket, current.raceId, true);
        } catch {
        }
      }

      try {
        await presenceStore.unregister(socket.id);
      } catch {
      }

      console.log(`[socket] disconnected ${socket.id} (${reason}) — ${clients.size} online`);
      await broadcastPresence();
    });

    registration
      .then(() => presenceSummary())
      .then((summary) => {
        socket.emit('presence:update', summary);
        return broadcastPresence();
      })
      .catch(() => {});
  });

  return io;
}

async function resolveUsername(userId) {
  const cacheKey = cacheKeys.username(userId);
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    usernameCache.set(userId, cached);
    return cached;
  }

  const userRepository = require('../repositories/userRepository');
  const record = await userRepository.findById(userId);
  if (!record) return null;

  usernameCache.set(userId, record.username);
  await cacheService.set(cacheKey, record.username, USERNAME_TTL_MS);
  return record.username;
}

function applyUsername(socket, username) {
  const current = clients.get(socket.id);
  if (!current) return;
  current.username = username;
  if (socket.data.user) socket.data.user.username = username;
  presenceStore.update(socket.id, { username }).catch(() => {});
}

async function leaveRace(socket, rawRaceId, alreadyLeft = false) {
  if (rawRaceId == null) return;
  const key = String(rawRaceId);
  const set = raceRooms.get(key);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) raceRooms.delete(key);
  }
  const current = clients.get(socket.id);
  if (current) current.raceId = null;

  await presenceStore.update(socket.id, { raceId: null });

  if (!alreadyLeft) {
    socket.leave(`race:${key}`);
    const summary = await presenceSummary(key);
    socket.emit('race:presence', { raceId: key, ...summary });
  }
}

const getIO = () => io;

function emitStandings(payload = {}) {
  return safeEmit('standings:update', { at: new Date().toISOString(), ...payload });
}

function emitLeaderboard(payload = {}) {
  return safeEmit('leaderboard:update', { at: new Date().toISOString(), ...payload });
}

function emitVote(raceId, payload = {}) {
  return safeEmit('vote:update', { raceId: String(raceId), at: new Date().toISOString(), ...payload }, `race:${raceId}`);
}

function emitComment(raceId, payload = {}) {
  return safeEmit('comment:update', { raceId: String(raceId), at: new Date().toISOString(), ...payload }, `race:${raceId}`);
}

function emitRaceStatus(payload = {}) {
  return safeEmit('race:status', { at: new Date().toISOString(), ...payload });
}

module.exports = {
  init,
  getIO,
  safeEmit,
  emitStandings,
  emitLeaderboard,
  emitVote,
  emitComment,
  emitRaceStatus,
  presenceSummary,
  _clients: clients,
  _raceRooms: raceRooms,
};
