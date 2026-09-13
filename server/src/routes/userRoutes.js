const router = require('express').Router();
const ctrl = require('../controllers/userController');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

router.get('/', authenticate, isAdmin, ctrl.getAll);
router.get('/:id', authenticate, isAdmin, ctrl.getById);
router.put('/:id', authenticate, isAdmin, ctrl.update);
router.delete('/:id', authenticate, isAdmin, ctrl.remove);

router.post('/:id/favorite-drivers', authenticate, ctrl.addFavoriteDriver);
router.delete('/:id/favorite-drivers/:driverId', authenticate, ctrl.removeFavoriteDriver);
router.post('/:id/favorite-teams', authenticate, ctrl.addFavoriteTeam);
router.delete('/:id/favorite-teams/:teamId', authenticate, ctrl.removeFavoriteTeam);

module.exports = router;
