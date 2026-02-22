const router = require('express').Router();
const { register, login, refresh, logout, verifyEmail, resendVerification, forgotPassword, resetPassword } = require('../controllers/authController');
const { registerValidationRules, loginValidationRules } = require('../utils/validators');
const { handleValidation } = require('../middlewares/validateMiddleware');

router.post('/register', registerValidationRules(), handleValidation, register);
router.post('/login', loginValidationRules(), handleValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerification);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

module.exports = router;
