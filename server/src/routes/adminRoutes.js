const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

router.get('/drivers', authenticate, isAdmin, ctrl.getDrivers);
router.get('/teams', authenticate, isAdmin, ctrl.getTeams);
router.post('/sync', authenticate, isAdmin, ctrl.syncF1);

module.exports = router;
