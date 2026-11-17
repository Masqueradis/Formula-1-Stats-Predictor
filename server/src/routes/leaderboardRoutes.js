'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/leaderboardController');
const cacheResponse = require('../middleware/cacheResponse');

router.get('/', cacheResponse(30 * 1000), ctrl.getLeaderboard);

module.exports = router;
