const router = require('express').Router();
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authenticate');
const { authLimiter, resendVerificationLimiter } = require('../middleware/rateLimit');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/resend-verification', resendVerificationLimiter, authController.resendVerification);
router.get('/verify/:token', authLimiter, authController.verify);
router.get('/me', authenticate, authController.me);

module.exports = router;
