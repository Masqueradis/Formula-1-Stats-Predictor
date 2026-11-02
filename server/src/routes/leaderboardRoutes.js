'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/leaderboardController');

// Публичный эндпоинт (Mongo + PostgreSQL) — рейтинг предсказателей (US-6)
router.get('/', ctrl.getLeaderboard);

module.exports = router;
