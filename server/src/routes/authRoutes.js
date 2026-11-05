const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.get('/verify/:token', authLimiter, authController.verify);
router.get('/me', authenticate, authController.me);

module.exports = router;
