const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

router.post('/sync', authenticate, isAdmin, ctrl.syncF1);

module.exports = router;
