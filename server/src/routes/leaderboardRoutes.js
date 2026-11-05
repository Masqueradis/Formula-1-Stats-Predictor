'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/leaderboardController');
const cacheResponse = require('../middleware/cacheResponse');

// Публичный эндпоинт (Mongo + PostgreSQL) — рейтинг предсказателей (US-6)
router.get('/', cacheResponse(30 * 1000), ctrl.getLeaderboard);

module.exports = router;
