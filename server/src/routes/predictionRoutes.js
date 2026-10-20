'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/predictionController');
const requireMongo = require('../middleware/requireMongo');
const { authenticate } = require('../middleware/authenticate');
const { isAdmin } = require('../middleware/authorize');

// Деградированный режим: без MongoDB весь /api/predictions отдаёт 503
router.use(requireMongo);

router.get('/', ctrl.getAll);
router.get('/next', ctrl.getNext);
router.get('/stats', ctrl.getStats);
router.get('/race/:raceId', ctrl.getByRace);

router.post('/race/:raceId/votes', authenticate, ctrl.createVote);
router.put('/race/:raceId/votes/:userId', authenticate, ctrl.updateVote);
router.delete('/race/:raceId/votes/:userId', authenticate, ctrl.removeVote);

router.post('/race/:raceId/comments', authenticate, ctrl.createComment);
router.put('/race/:raceId/comments/:commentId/like', authenticate, ctrl.toggleLike);
router.delete('/race/:raceId/comments/:commentId', authenticate, ctrl.removeComment);

router.delete('/race/:raceId', authenticate, isAdmin, ctrl.remove);

module.exports = router;
