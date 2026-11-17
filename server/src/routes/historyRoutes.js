const router = require('express').Router();
const ctrl = require('../controllers/historyController');
const cacheResponse = require('../middleware/cacheResponse');

const cache = cacheResponse(10 * 60 * 1000);

router.get('/seasons', cache, ctrl.getSeasons);
router.get('/races', cache, ctrl.getRaces);
router.get('/races/:id', cache, ctrl.getRace);

module.exports = router;
