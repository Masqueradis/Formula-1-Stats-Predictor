const router = require('express').Router();
const ctrl = require('../controllers/standingsController');

router.get('/', ctrl.getStandings);

module.exports = router;