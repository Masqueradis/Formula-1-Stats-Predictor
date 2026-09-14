const router = require('express').Router();

router.use('/auth', require('./authRoutes'));
router.use('/drivers', require('./driverRoutes'));
router.use('/teams', require('./teamRoutes'));
router.use('/races', require('./raceRoutes'));
router.use('/race-results', require('./raceResultRoutes'));
router.use('/season-teams', require('./seasonTeamRoutes'));
router.use('/users', require('./userRoutes'));

module.exports = router;
