'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/probabilityController');

// Публичный эндпоинт (PostgreSQL, без Mongo) — вероятности Softmax на ближайший Гран-при
router.get('/next', ctrl.getNext);

module.exports = router;
