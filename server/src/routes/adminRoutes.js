const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

// Все админ-роуты защищены (эпик-09, Phase 10)
router.use(authenticate, isAdmin);

router.get('/drivers', ctrl.getDrivers);
router.get('/teams', ctrl.getTeams);
router.post('/sync', ctrl.syncF1);

module.exports = router;
