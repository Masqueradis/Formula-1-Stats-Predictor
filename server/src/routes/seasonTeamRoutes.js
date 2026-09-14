const router = require('express').Router();
const ctrl = require('../controllers/seasonTeamController');
const { authenticate } = require('../middleware/authenticate');

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', authenticate, ctrl.create);
router.put('/:id', authenticate, ctrl.update);
router.delete('/:id', authenticate, ctrl.remove);

module.exports = router;
