'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/probabilityController');
const cacheResponse = require('../middleware/cacheResponse');

router.get('/next', cacheResponse(60 * 1000), ctrl.getNext);

module.exports = router;
