'use strict';

const { Op } = require('sequelize');
const { Types } = require('mongoose');
const raceRepository = require('../repositories/raceRepository');
const seasonTeamRepository = require('../repositories/seasonTeamRepository');
const userRepository = require('../repositories/userRepository');
const predictionRepository = require('../repositories/predictionRepository');

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

function parseId(rawId) {
  const id = Number(rawId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Ключ гонки в Mongo: races.externalId (напр. "2026-5"), иначе числовой id */
function raceKey(race) {
  return race.externalId || String(race.id);
}

/** Поиск гонки в PostgreSQL по externalId или по числовому id */
async function resolveRace(rawRaceId) {
  if (!rawRaceId) return null;
  const byExternal = await raceRepository.findOne({ externalId: String(rawRaceId) });
  if (byExternal) return byExternal;
  const id = parseId(rawRaceId);
  if (id !== null) return raceRepository.findById(id);
  return null;
}

/** Состав пилотов сезона из PostgreSQL season_teams (снимок для документа).
 *  isReserve (резервисты/замены) исключаются — они не участвуют в Гран-при постоянно. */
async function buildEntries(season) {
  const seasonTeams = await seasonTeamRepository.findAll({
    where: { season, isReserve: false },
    include: [
      { association: 'team', attributes: ['name', 'color'] },
      { association: 'driver', attributes: ['id', 'firstName', 'lastName', 'abbreviation', 'number', 'isActive'] },
    ],
    order: [['id', 'ASC']],
  });
  const entries = [];
  const seen = new Set();
  for (const st of seasonTeams) {
    const driver = st.driver;
    if (!driver || driver.isActive === false || seen.has(driver.id)) continue;
    seen.add(driver.id);
    entries.push({
      driverId: driver.id,
      firstName: driver.firstName || '',
      lastName: driver.lastName,
      abbreviation: driver.abbreviation || '',
      number: driver.number ?? null,
      teamName: st.team ? st.team.name : '',
      teamColor: st.team ? st.team.color : '',
    });
  }
  return entries;
}

/**
 * Снапшот документа должен соответствовать PostgreSQL: состав гонки (season_teams,
 * включая isReserve) и метаданные гонки (статус/дата) обновляются при каждом чтении.
 */
async function refreshSnapshot(doc, race) {
  const entries = await buildEntries(race.season);
  const fresh = {
    raceName: race.name,
    circuit: race.circuit || '',
    country: race.country || '',
    date: race.date || '',
    season: race.season,
    round: race.round,
    status: race.status,
  };
  const current = doc.toObject();
  const fields = {};
  for (const [key, value] of Object.entries(fresh)) {
    if (current[key] !== value) fields[key] = value;
  }
  if (JSON.stringify(current.entries) !== JSON.stringify(entries)) {
    fields.entries = entries;
  }
  if (Object.keys(fields).length === 0) return doc;
  console.log(`[mongo] race doc ${doc.raceId} snapshot refreshed: ${Object.keys(fields).join(', ')}`);
  return predictionRepository.setFields(doc.raceId, fields);
}

/** Ленивое создание документа гонки в MongoDB (снимок состава из PG) */
async function ensureDoc(race) {
  const raceId = raceKey(race);
  const existing = await predictionRepository.findByRaceId(raceId);
  if (existing) return refreshSnapshot(existing, race);
  const entries = await buildEntries(race.season);
  try {
    return await predictionRepository.create({
      raceId,
      raceName: race.name,
      circuit: race.circuit || '',
      country: race.country || '',
      date: race.date || '',
      season: race.season,
      round: race.round,
      status: race.status,
      entries,
    });
  } catch (err) {
    // Гонку могли создать конкурентно — возвращаем существующий документ
    if (err.code === 11000) {
      const doc = await predictionRepository.findByRaceId(raceId);
      if (doc) return doc;
    }
    throw err;
  }
}

async function getDocForRace(rawRaceId) {
  const race = await resolveRace(rawRaceId);
  if (!race) throw httpError(404, 'Race not found');
  const doc = await ensureDoc(race);
  return { race, doc };
}

/** Правило «голосование до старта»: закрыто начиная с дня гонки (дата из PG — DATEONLY) */
function isVotingOpen(json) {
  if (json.status !== 'scheduled') return false;
  if (!json.date) return true;
  return Date.now() < new Date(`${json.date}T00:00:00`).getTime();
}

function presentDoc(doc) {
  const json = doc.toObject ? doc.toObject() : doc;
  return { ...json, votingOpen: isVotingOpen(json) };
}

function assertVotingOpen(json) {
  if (!isVotingOpen(json)) {
    throw httpError(409, 'Voting is closed — the race weekend has started or the race is not scheduled');
  }
}

async function displayUser(userId) {
  const user = await userRepository.findById(userId);
  return user ? user.username : `user#${userId}`;
}

/** Нормализация входа: { kind: 'full'|'top3', picks: [{driverId, position}] } */
function normalizePicks(body) {
  const kind = body && body.kind === 'top3' ? 'top3' : 'full';
  const raw = body && Array.isArray(body.picks) ? body.picks : null;
  if (!raw) throw httpError(400, 'picks must be an array of { driverId, position }');
  const picks = raw.map((p) => ({
    driverId: Number(p && p.driverId),
    position: Number(p && p.position),
  }));
  for (const p of picks) {
    if (!Number.isInteger(p.driverId) || p.driverId <= 0) {
      throw httpError(400, 'Invalid driverId in picks');
    }
    if (!Number.isInteger(p.position) || p.position < 1) {
      throw httpError(400, 'Invalid position in picks: must be an integer >= 1');
    }
  }
  return { kind, picks };
}

/**
 * Кросс-проверка прогноза против состава документа (entries).
 * 'full'  — полная перестановка 1..N по ВСЕМ пилотам гонки (народный прогноз).
 * 'top3'  — ровно 3 пилота, места 1-2-3 (личный прогноз кабинета US-5).
 */
function validatePicks(doc, kind, picks) {
  const entryIds = doc.entries.map((e) => e.driverId);
  const driverIds = picks.map((p) => p.driverId);

  if (new Set(driverIds).size !== driverIds.length) {
    throw httpError(400, 'Duplicate drivers in picks');
  }
  if (driverIds.some((id) => !entryIds.includes(id))) {
    throw httpError(400, 'Pick contains a driver who is not in this race');
  }

  if (kind === 'full') {
    if (picks.length !== entryIds.length) {
      throw httpError(422, `Expected predictions for all ${entryIds.length} drivers, got ${picks.length}`);
    }
    const positions = picks.map((p) => p.position);
    const expected = new Set(Array.from({ length: entryIds.length }, (_, i) => i + 1));
    if (new Set(positions).size !== positions.length || positions.some((pos) => !expected.has(pos))) {
      throw httpError(422, `Positions must be a unique permutation from 1 to ${entryIds.length}`);
    }
  } else {
    if (picks.length !== 3) {
      throw httpError(422, 'top3 prediction requires exactly 3 drivers');
    }
    const positions = picks.map((p) => p.position).sort((a, b) => a - b);
    if (positions.join(',') !== '1,2,3') {
      throw httpError(422, 'top3 positions must be exactly 1, 2 and 3');
    }
  }
}

// ---------- Чтение ----------

async function getAll() {
  const docs = await predictionRepository.findAll();
  return docs.map(presentDoc);
}

async function getByRaceId(rawRaceId) {
  const { doc } = await getDocForRace(rawRaceId);
  return presentDoc(doc);
}

/** Документ следующей гонки: min(date >= сегодня, status='scheduled') + ленивое создание */
async function getNext() {
  const today = new Date().toISOString().slice(0, 10);
  const race = await raceRepository.findOne(
    { status: 'scheduled', date: { [Op.gte]: today } },
    { order: [['date', 'ASC'], ['season', 'ASC'], ['round', 'ASC']] },
  );
  if (!race) throw httpError(404, 'No upcoming race scheduled');
  const doc = await ensureDoc(race);
  return presentDoc(doc);
}

/**
 * Народный рейтинг: aggregation pipeline ($unwind → $group → $sort).
 * ?raceId= — по одной гонке; без параметра — по всем документам.
 */
async function getStats(rawRaceId) {
  let match = {};
  let docs;
  if (rawRaceId) {
    const race = await resolveRace(rawRaceId);
    if (!race) throw httpError(404, 'Race not found');
    const doc = await ensureDoc(race);
    match = { raceId: doc.raceId };
    docs = [doc];
  } else {
    docs = await predictionRepository.findAll();
  }

  const rows = await predictionRepository.aggregateStats(match);
  const entriesByRace = new Map(docs.map((d) => [d.raceId, new Map(d.entries.map((e) => [e.driverId, e]))]));

  const findEntry = (raceId, driverId) => {
    const map = entriesByRace.get(raceId);
    return (map && map.get(driverId)) || null;
  };

  const round2 = (v) => Math.round(v * 100) / 100;
  const stats = rows.map((r) => {
    const entry = findEntry(r.raceIds[0], r._id);
    return {
      driverId: r._id,
      driver: entry
        ? { firstName: entry.firstName, lastName: entry.lastName, abbreviation: entry.abbreviation, teamName: entry.teamName, teamColor: entry.teamColor }
        : null,
      avgPosition: round2(r.avgPosition),
      bestPosition: r.bestPosition,
      worstPosition: r.worstPosition,
      votesCount: r.votesCount,
    };
  });

  // Для конкретной гонки добавляем пилотов без голосов (avgPosition: null)
  if (rawRaceId && docs[0]) {
    const known = new Set(stats.map((s) => s.driverId));
    for (const entry of docs[0].entries) {
      if (known.has(entry.driverId)) continue;
      stats.push({
        driverId: entry.driverId,
        driver: { firstName: entry.firstName, lastName: entry.lastName, abbreviation: entry.abbreviation, teamName: entry.teamName, teamColor: entry.teamColor },
        avgPosition: null,
        bestPosition: null,
        worstPosition: null,
        votesCount: 0,
      });
    }
  }

  return stats;
}

// ---------- Голосование ----------

async function createVote(rawRaceId, user, body) {
  const { doc } = await getDocForRace(rawRaceId);
  assertVotingOpen(doc);
  const { kind, picks } = normalizePicks(body);
  validatePicks(doc, kind, picks);

  const username = await displayUser(user.id);
  const updated = await predictionRepository.addVote(doc.raceId, {
    userId: user.id,
    username,
    kind,
    picks,
  });
  // Атомарное условие не совпало → голос этого пользователя уже есть
  if (!updated) throw httpError(409, 'You have already voted in this race');
  return presentDoc(updated);
}

async function updateVote(rawRaceId, targetUserId, user, body) {
  const targetId = parseId(targetUserId);
  if (targetId === null) throw httpError(404, 'Vote not found');
  if (targetId !== user.id && user.role !== 'ADMIN') {
    throw httpError(403, 'You can only edit your own vote');
  }

  const { doc } = await getDocForRace(rawRaceId);
  assertVotingOpen(doc);
  const { kind, picks } = normalizePicks(body);
  validatePicks(doc, kind, picks);

  const updated = await predictionRepository.updateVote(doc.raceId, targetId, { kind, picks });
  if (!updated) throw httpError(404, 'Vote not found');
  return presentDoc(updated);
}

async function removeVote(rawRaceId, targetUserId, user) {
  const targetId = parseId(targetUserId);
  if (targetId === null) throw httpError(404, 'Vote not found');
  if (targetId !== user.id && user.role !== 'ADMIN') {
    throw httpError(403, 'You can only delete your own vote');
  }

  const { doc } = await getDocForRace(rawRaceId);
  assertVotingOpen(doc);

  const updated = await predictionRepository.removeVote(doc.raceId, targetId);
  if (!updated) throw httpError(404, 'Vote not found');
  return presentDoc(updated);
}

// ---------- Комментарии ----------

async function createComment(rawRaceId, user, body) {
  const { doc } = await getDocForRace(rawRaceId);
  const text = body && typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) throw httpError(400, 'Comment text is required');
  if (text.length > 2000) throw httpError(422, 'Comment is too long (max 2000 characters)');

  const username = await displayUser(user.id);
  const updated = await predictionRepository.addComment(doc.raceId, {
    userId: user.id,
    username,
    text,
  });
  return presentDoc(updated);
}

/** Поиск комментария (subdocument) по _id; невалидный ObjectId → 404 */
function findComment(doc, commentId) {
  if (!Types.ObjectId.isValid(commentId)) throw httpError(404, 'Comment not found');
  const comment = doc.comments.id(commentId);
  if (!comment) throw httpError(404, 'Comment not found');
  return comment;
}

async function removeComment(rawRaceId, commentId, user) {
  const { doc } = await getDocForRace(rawRaceId);
  const comment = findComment(doc, commentId);
  if (Number(comment.userId) !== user.id && user.role !== 'ADMIN') {
    throw httpError(403, 'You can only delete your own comment');
  }

  const updated = await predictionRepository.removeComment(doc.raceId, commentId);
  return presentDoc(updated);
}

/** Лайк: toggle через $addToSet / $pull (демонстрация обновления внутри массива) */
async function toggleLike(rawRaceId, commentId, user) {
  const { doc } = await getDocForRace(rawRaceId);
  const comment = findComment(doc, commentId);

  const liked = comment.likes.some((id) => Number(id) === user.id);
  const updated = liked
    ? await predictionRepository.removeLike(doc.raceId, commentId, user.id)
    : await predictionRepository.addLike(doc.raceId, commentId, user.id);
  if (!updated) throw httpError(404, 'Comment not found');
  return presentDoc(updated);
}

// ---------- Удаление документа ----------

/** Удаление документа гонки (ADMIN, роут) — findOneAndDelete возвращает удалённый */
async function removeRaceDoc(rawRaceId) {
  const race = await resolveRace(rawRaceId);
  if (!race) throw httpError(404, 'Race not found');
  const deleted = await predictionRepository.removeByRaceId(raceKey(race));
  if (!deleted) throw httpError(404, 'Prediction document not found');
  return deleted;
}

/**
 * Каскад между БД (решение В3): удаление гонки в PostgreSQL →
 * best-effort удаление её документа в MongoDB (связка двух БД вручную).
 */
async function cascadeRemoveByRace(race) {
  try {
    const deleted = await predictionRepository.removeByRaceId(raceKey(race));
    if (deleted) console.log(`[mongo] race doc ${deleted.raceId} removed (cascade from PostgreSQL)`);
    return deleted;
  } catch (err) {
    console.warn(`[mongo] cascade delete failed for race ${raceKey(race)}: ${err.message}`);
    return null;
  }
}

module.exports = {
  getAll,
  getByRaceId,
  getNext,
  getStats,
  createVote,
  updateVote,
  removeVote,
  createComment,
  removeComment,
  toggleLike,
  removeRaceDoc,
  cascadeRemoveByRace,
};
