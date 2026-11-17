const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');
const { adminSyncLimiter } = require('../middleware/rateLimit');

router.use(authenticate, isAdmin);

router.get('/drivers', ctrl.getDrivers);
router.get('/teams', ctrl.getTeams);
router.post('/sync', adminSyncLimiter, ctrl.syncF1);

module.exports = router;
