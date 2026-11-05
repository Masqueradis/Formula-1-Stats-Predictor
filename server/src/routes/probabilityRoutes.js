'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/probabilityController');
const cacheResponse = require('../middleware/cacheResponse');

// Публичный эндпоинт (PostgreSQL, без Mongo) — вероятности Softmax на ближайший Гран-при
router.get('/next', cacheResponse(60 * 1000), ctrl.getNext);

module.exports = router;
