const router = require('express').Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const { registerValidationRules, loginValidationRules } = require('../utils/validators');
const { handleValidation } = require('../middlewares/validateMiddleware');

router.post('/register', registerValidationRules(), handleValidation, register);
router.post('/login', loginValidationRules(), handleValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);

module.exports = router;
