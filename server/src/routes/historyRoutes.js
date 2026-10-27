const router = require('express').Router();
const ctrl = require('../controllers/historyController');

router.get('/seasons', ctrl.getSeasons);
router.get('/races', ctrl.getRaces);
router.get('/races/:id', ctrl.getRace);

module.exports = router;
