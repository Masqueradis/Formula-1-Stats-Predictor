const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/drivers', require('./driverRoutes'));
router.use('/teams', require('./teamRoutes'));
router.use('/races', require('./raceRoutes'));
router.use('/history', require('./historyRoutes'));
router.use('/race-results', require('./raceResultRoutes'));
router.use('/season-teams', require('./seasonTeamRoutes'));
router.use('/users', require('./userRoutes'));
router.use('/news', require('./newsRoutes'));
router.use('/standings', require('./standingsRoutes'));
router.use('/probabilities', require('./probabilityRoutes'));
router.use('/leaderboard', require('./leaderboardRoutes'));
router.use('/predictions', require('./predictionRoutes'));
router.use('/admin', require('./adminRoutes'));

module.exports = router;
