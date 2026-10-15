const router = require('express').Router();
const ctrl = require('../controllers/seasonTeamController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authenticate, isAdmin, ctrl.create);
router.put('/:id', authenticate, isAdmin, ctrl.update);
router.delete('/:id', authenticate, isAdmin, ctrl.remove);

module.exports = router;
