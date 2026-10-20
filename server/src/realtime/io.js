'use strict';

/**
 * Синглтон Socket.IO для лабы 7 (WebSocket / real-time).
 *
 * Особенности:
 * - `getIO()` возвращает null, если сокет ещё не инициализирован — сервер без HTTP-сокета
 *   (например, при импорте в тестах) не падает.
 * - Все исходящие события идут через `safeEmit` (try/catch) — realtime никогда не ломает
 *   бизнес-логику запроса.
 * - Presence считается по `Map<socket.id, user>`: количество соединений и уникальные
 *   пользователи. Гость (`user == null`) получает имя «Гость».
 * - Реестр комнат гонок (`race:<raceId>`) считается локально, чтобы отдавать в событии
 *   количество подключённых к конкретной гонке.
 */

const { Server } = require('socket.io');

let io = null;

// socket.id -> { userId, username, role, raceId }
const clients = new Map();

// raceId -> Set<socketId>
const raceRooms = new Map();

// userId -> username (в JWT username нет, чтобы не запрашивать БД на каждый коннект)
const usernameCache = new Map();

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

function presenceSummary(raceId = null) {
  const connections = clients.size;
  const users = new Set();
  for (const client of clients.values()) {
    if (client.userId != null) users.add(client.userId);
  }
  const guestConnections = [...clients.values()].filter((c) => c.userId == null).length;
  const raceConnections = raceId != null ? (raceRooms.get(String(raceId))?.size || 0) : undefined;
  return {
    connections,
    guests: guestConnections,
    users: [...users],
    usersCount: users.size,
    raceConnections,
  };
}

function broadcastPresence() {
  safeEmit('presence:update', presenceSummary());
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
    clients.set(socket.id, {
      userId: user.userId ?? null,
      username: user.username || 'Гость',
      role: user.role || null,
      raceId: null,
    });

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

    // ── Комнаты по гонкам ────────────────────────────────────────────────
    socket.on('race:join', (payload) => {
      const raceId = payload?.raceId;
      if (raceId == null) return;

      const key = String(raceId);
      socket.join(`race:${key}`);
      const entry = clients.get(socket.id);
      if (entry) entry.raceId = key;

      const set = raceRooms.get(key) || new Set();
      set.add(socket.id);
      raceRooms.set(key, set);

      socket.emit('race:presence', { raceId: key, ...presenceSummary(key) });
    });

    socket.on('race:leave', (payload) => {
      leaveRace(socket, payload?.raceId);
    });

    // ── Индикатор набора текста ──────────────────────────────────────────
    socket.on('comment:typing', (payload) => {
      const raceId = payload?.raceId;
      if (raceId == null) return;
      const entry = clients.get(socket.id) || {};
      socket.broadcast.to(`race:${String(raceId)}`).emit('comment:typing', {
        raceId: String(raceId),
        username: entry.username || 'Гость',
        userId: entry.userId ?? null,
        at: new Date().toISOString(),
      });
    });

    socket.on('disconnect', (reason) => {
      const entry = clients.get(socket.id);
      clients.delete(socket.id);
      if (entry?.raceId) leaveRace(socket, entry.raceId, true);

      console.log(`[socket] disconnected ${socket.id} (${reason}) — ${clients.size} online`);
      broadcastPresence();
    });

    // Персональное приветствие текущим presence — сразу после регистрации обработчиков
    socket.emit('presence:update', presenceSummary());
    broadcastPresence();
  });

  return io;
}

/** username из БД по userId (кэшируется), null при неудаче. */
async function resolveUsername(userId) {
  const userRepository = require('../repositories/userRepository');
  const record = await userRepository.findById(userId);
  if (!record) return null;
  usernameCache.set(userId, record.username);
  return record.username;
}

/** Записать найденный username в реестр клиентов (для typing и подписей). */
function applyUsername(socket, username) {
  const entry = clients.get(socket.id);
  if (!entry) return;
  entry.username = username;
  if (socket.data.user) socket.data.user.username = username;
}

function leaveRace(socket, rawRaceId, alreadyLeft = false) {
  if (rawRaceId == null) return;
  const key = String(rawRaceId);
  const set = raceRooms.get(key);
  if (set) {
    set.delete(socket.id);
    if (set.size === 0) raceRooms.delete(key);
  }
  const entry = clients.get(socket.id);
  if (entry) entry.raceId = null;

  if (!alreadyLeft) {
    socket.leave(`race:${key}`);
    socket.emit('race:presence', { raceId: key, ...presenceSummary(key) });
  }
}

const getIO = () => io;

/** Обновление турнирной таблицы (результаты, синк). */
function emitStandings(payload = {}) {
  return safeEmit('standings:update', { at: new Date().toISOString(), ...payload });
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
  emitVote,
  emitComment,
  emitRaceStatus,
  presenceSummary,
  // для тестов/диагностики
  _clients: clients,
  _raceRooms: raceRooms,
};
