'use strict';

const mongoose = require('mongoose');

/**
 * Документ-снапшот гонки (коллекция race_prediction_docs).
 *
 * Связь с PostgreSQL (races.externalId / users.id / drivers.id) — кросс-БД,
 * поэтому ref + populate НЕ применимы: вместо ссылок денормализованный
 * снимок состава `entries` прямо в документе (см. контрольные вопросы 8, 10).
 */

// Снимок состава гонки (пилот + его команда) из PostgreSQL season_teams
const entrySchema = new mongoose.Schema({
  driverId: { type: Number, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, required: true },
  abbreviation: { type: String, default: '' },
  number: { type: Number, default: null },
  teamName: { type: String, default: '' },
  teamColor: { type: String, default: '' },
}, { _id: false });

// Один прогноз пилота внутри голосования (ожидаемое финишное место)
const pickSchema = new mongoose.Schema({
  driverId: { type: Number, required: true },
  position: { type: Number, required: true, min: 1, max: 60 },
}, { _id: false });

// Голосование пользователя (вложенный документ, не отдельная коллекция)
const voteSchema = new mongoose.Schema({
  userId: { type: Number, required: true },      // users.id (PostgreSQL)
  username: { type: String, required: true },
  // 'full' — перестановка 1..N по всем пилотам (народный прогноз, эпик-06)
  // 'top3' — личный прогноз кабинета US-5 (будущая фича, формат зарезервирован)
  kind: { type: String, enum: ['full', 'top3'], default: 'full' },
  picks: { type: [pickSchema], default: [] },
}, { timestamps: true });

// Комментарий к гонке (вложенный документ + массив likes)
const commentSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  likes: { type: [Number], default: [] },         // массив userId — демо обновления внутри массива
}, { timestamps: true });

const racePredictionDocSchema = new mongoose.Schema({
  raceId: { type: String, required: true, unique: true, index: true }, // races.externalId | String(races.id)
  raceName: { type: String, required: true },
  circuit: { type: String, default: '' },
  country: { type: String, default: '' },
  date: { type: String, default: '' },            // YYYY-MM-DD (DATEONLY из PostgreSQL)
  season: { type: Number, required: true },
  round: { type: Number, required: true },
  status: { type: String, enum: ['scheduled', 'finished', 'cancelled'], default: 'scheduled' },
  entries: { type: [entrySchema], default: [] },  // массив вложенных документов (состав)
  votes: { type: [voteSchema], default: [] },     // массив вложенных документов (голоса)
  comments: { type: [commentSchema], default: [] }, // массив вложенных документов (комментарии)
}, {
  timestamps: true,
  collection: 'race_prediction_docs',
});

// Индекс для поиска голосов по пользователю (контрольный вопрос 9)
racePredictionDocSchema.index({ 'votes.userId': 1 });
racePredictionDocSchema.index({ 'comments.userId': 1 });

/** Есть ли голос этого пользователя (instance method, вопрос 14) */
racePredictionDocSchema.methods.hasVoteFrom = function (userId) {
  const id = Number(userId);
  return this.votes.some(v => Number(v.userId) === id);
};

/** Голос конкретного пользователя */
racePredictionDocSchema.methods.getVoteBy = function (userId) {
  const id = Number(userId);
  return this.votes.find(v => Number(v.userId) === id) || null;
};

/** Готовность к голосованию: состав объявлен (static, вопрос 14) */
racePredictionDocSchema.statics.isReady = function (doc) {
  return Boolean(doc && Array.isArray(doc.entries) && doc.entries.length > 0);
};

module.exports = mongoose.model('RacePredictionDoc', racePredictionDocSchema, 'race_prediction_docs');
