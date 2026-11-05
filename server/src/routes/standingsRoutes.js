const router = require('express').Router();
const ctrl = require('../controllers/standingsController');
const cacheResponse = require('../middleware/cacheResponse');

router.get('/', cacheResponse(60 * 1000), ctrl.getStandings);

module.exports = router;
