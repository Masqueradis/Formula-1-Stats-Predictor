'use strict';

const mongoose = require('mongoose');

const entrySchema = new mongoose.Schema({
  driverId: { type: Number, required: true },
  firstName: { type: String, default: '' },
  lastName: { type: String, required: true },
  abbreviation: { type: String, default: '' },
  number: { type: Number, default: null },
  teamName: { type: String, default: '' },
  teamColor: { type: String, default: '' },
}, { _id: false });

const pickSchema = new mongoose.Schema({
  driverId: { type: Number, required: true },
  position: { type: Number, required: true, min: 1, max: 60 },
}, { _id: false });

const voteSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: { type: String, required: true },
  kind: { type: String, enum: ['full', 'top3'], default: 'full' },
  picks: { type: [pickSchema], default: [] },
  score: { type: Number, default: null },
  exactHits: { type: Number, default: null },
  podiumHits: { type: Number, default: null },
  scoredAt: { type: Date, default: null },
}, { timestamps: true });

const commentSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true, trim: true, maxlength: 2000 },
  likes: { type: [Number], default: [] },
}, { timestamps: true });

const racePredictionDocSchema = new mongoose.Schema({
  raceId: { type: String, required: true, unique: true, index: true },
  raceName: { type: String, required: true },
  circuit: { type: String, default: '' },
  country: { type: String, default: '' },
  date: { type: String, default: '' },
  season: { type: Number, required: true },
  round: { type: Number, required: true },
  status: { type: String, enum: ['scheduled', 'finished', 'cancelled'], default: 'scheduled' },
  entries: { type: [entrySchema], default: [] },
  votes: { type: [voteSchema], default: [] },
  comments: { type: [commentSchema], default: [] },
}, {
  timestamps: true,
  collection: 'race_prediction_docs',
});

racePredictionDocSchema.index({ 'votes.userId': 1 });
racePredictionDocSchema.index({ 'comments.userId': 1 });

racePredictionDocSchema.methods.hasVoteFrom = function (userId) {
  const id = Number(userId);
  return this.votes.some(v => Number(v.userId) === id);
};

racePredictionDocSchema.methods.getVoteBy = function (userId) {
  const id = Number(userId);
  return this.votes.find(v => Number(v.userId) === id) || null;
};

racePredictionDocSchema.statics.isReady = function (doc) {
  return Boolean(doc && Array.isArray(doc.entries) && doc.entries.length > 0);
};

module.exports = mongoose.model('RacePredictionDoc', racePredictionDocSchema, 'race_prediction_docs');
