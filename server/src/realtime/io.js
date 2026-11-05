'use strict';

/**
 * Синглтон Socket.IO для лабы 7 (WebSocket / real-time).
 *
 * Особенности:
 * - `getIO()` возвращает null, если сокет ещё не инициализирован — сервер без HTTP-сокета
 *   (например, при импорте в тестах) не падает.
 * - Все исходящие события идут через `safeEmit` (try/catch) — realtime никогда не ломает
 *   бизнес-логику запроса.
 * - Presence считается по `Map<socket.id, user>` (L1) и зеркалируется в Redis
 *   (`presenceStore`), чтобы несколько инстансов видели общую картину.
 * - Реестр комнат гонок (`race:<raceId>`) считается локально, чтобы отдавать в событии
 *   количество подключённых к конкретной гонке.
 */

const { Server } = require('socket.io');
const presenceStore = require('./presenceStore');
const { setupRedisAdapter } = require('./redisAdapter');
const cacheService = require('../cache/cacheService');
const cacheKeys = require('../cache/keys');

let io = null;

// socket.id -> { userId, username, role, raceId }
const clients = new Map();

// raceId -> Set<socketId>
const raceRooms = new Map();

// userId -> username (в JWT username нет, чтобы не запрашивать БД на каждый коннект)
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
    // Ленивый require, чтобы избежать циклических зависимостей и сохранить единый секрет
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
    // presence не должен ломать realtime
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

/** @param {import('http').Server} httpServer */
function init(httpServer) {
  if (io) return io;

  const { ALLOWED_ORIGINS } = require('../middleware/cors');

  io = new Server(httpServer, {
    cors: {
      origin: ALLOWED_ORIGINS,
      credentials: true,
    },
    // Заголовок с доступными транспортами не нужен: клиент подберёт сам
    serveClient: false,
  });

  // Адаптер подключается в фоне: без Redis Socket.IO работает в single-instance.
  setupRedisAdapter(io).catch((err) =>
    console.warn(`[realtime] redis adapter setup failed: ${err.message}`),
  );

  // Уборка «зависших» presence-записей от упавших инстансов.
  const cleanupTimer = setInterval(() => {
    presenceStore.cleanup().catch(() => {});
  }, PRESENCE_CLEANUP_MS);
  if (typeof cleanupTimer.unref === 'function') cleanupTimer.unref();

  // Опциональная аутентификация: JWT из handshake.auth.token. Гости допускаются.
  io.use((socket, next) => {
    const decoded = verifyToken(resolveToken(socket));
    // В JWT payload — { id, email, role }; username дотягивается из БД в обработчике connection
    socket.data.user = decoded
      ? { userId: decoded.id, username: null, email: decoded.email || null, role: decoded.role }
      : null;
    next();
  });

  io.on('connection', (socket) => {
    const user = socket.data.user || {};

    // Регистрируем обработчики СИНХРОННО — иначе await резолва username ниже
    // мог бы "проспать" раннее race:join от клиента.
    const entry = {
      userId: user.userId ?? null,
      username: user.username || 'Гость',
      role: user.role || null,
      raceId: null,
    };
    clients.set(socket.id, entry);
    const registration = presenceStore.register(socket.id, entry).catch(() => {});

    // В JWT username отсутствует (id/email/role) — дотягиваем из БД с кэшем по userId.
    // Асинхронно и НЕ блокирует обработчики; при успехе обновляем запись в реестре клиентов.
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

    // Heartbeat: обновляет updatedAt в Redis; устаревшие записи отбрасываются в summary.
    const heartbeatTimer = setInterval(() => {
      presenceStore.heartbeat(socket.id).catch(() => {});
    }, HEARTBEAT_MS);
    if (typeof heartbeatTimer.unref === 'function') heartbeatTimer.unref();

    // ── Комнаты по гонкам ────────────────────────────────────────────────
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

    // ── Индикатор набора текста ──────────────────────────────────────────
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

    socket.on('disconnect', (reason) => {
      clearInterval(heartbeatTimer);
      const current = clients.get(socket.id);
      clients.delete(socket.id);
      if (current?.raceId) leaveRace(socket, current.raceId, true);

      presenceStore
        .unregister(socket.id)
        .catch(() => {})
        .then(() => {
          console.log(`[socket] disconnected ${socket.id} (${reason}) — ${clients.size} online`);
          return broadcastPresence();
        });
    });

    // Персональное приветствие текущим presence — сразу после регистрации обработчиков
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

/** username из БД по userId (L1 + Redis-кэш), null при неудаче. */
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

/** Записать найденный username в реестр клиентов (для typing и подписей). */
function applyUsername(socket, username) {
  const current = clients.get(socket.id);
  if (!current) return;
  current.username = username;
  if (socket.data.user) socket.data.user.username = username;
  presenceStore.update(socket.id, { username }).catch(() => {});
}

function leaveRace(socket, rawRaceId, alreadyLeft = false) {
  if (rawRaceId == null) return;
  const key = String(rawRaceId);
  const set = raceRooms.get(key);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) raceRooms.delete(key);
  }
  const current = clients.get(socket.id);
  if (current) current.raceId = null;

  presenceStore.update(socket.id, { raceId: null }).catch(() => {});

  if (!alreadyLeft) {
    socket.leave(`race:${key}`);
    presenceSummary(key)
      .then((summary) => socket.emit('race:presence', { raceId: key, ...summary }))
      .catch(() => {});
  }
}

const getIO = () => io;

/** Обновление турнирной таблицы (результаты, синк). */
function emitStandings(payload = {}) {
  return safeEmit('standings:update', { at: new Date().toISOString(), ...payload });
}

/** Пересчёт рейтинга предсказателей (cron UC-2) — страница «Рейтинг». */
function emitLeaderboard(payload = {}) {
  return safeEmit('leaderboard:update', { at: new Date().toISOString(), ...payload });
}

/** Обновление народного прогноза (голоса) для конкретной гонки. */
function emitVote(raceId, payload = {}) {
  return safeEmit('vote:update', { raceId: String(raceId), at: new Date().toISOString(), ...payload }, `race:${raceId}`);
}

/** Событие по комментариям гонки (new/like/remove) — только участникам комнаты. */
function emitComment(raceId, payload = {}) {
  return safeEmit('comment:update', { raceId: String(raceId), at: new Date().toISOString(), ...payload }, `race:${raceId}`);
}

/** Смена статуса гонки (запланирована/завершена/отменена) — всем клиентам. */
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
  // для тестов/диагностики
  _clients: clients,
  _raceRooms: raceRooms,
};
