const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const { body } = require('express-validator');
const { auth } = require('../middlewares/authMiddleware');
const { handleValidation } = require('../middlewares/validateMiddleware');
const { chatWithAssistant } = require('../controllers/aiController');

const isAssistantEnabled = () => {
	const raw = String(process.env.AI_ASSISTANT_ENABLED ?? 'true').trim().toLowerCase();
	return !['0', 'false', 'off', 'no'].includes(raw);
};

const aiLimiter = rateLimit({
	windowMs: 60 * 1000,
	max: Number(process.env.AI_RATE_LIMIT_MAX || 20),
	standardHeaders: true,
	legacyHeaders: false,
	message: { message: 'Too many assistant requests. Please slow down.' },
});

const aiChatValidation = [
	body('message')
		.trim()
		.isLength({ min: 1, max: 1200 })
		.withMessage('message must be between 1 and 1200 characters'),
	body('history')
		.optional()
		.isArray({ max: 12 })
		.withMessage('history must be an array with at most 12 items'),
	body('history.*.role')
		.optional()
		.isIn(['user', 'assistant'])
		.withMessage('history role must be user or assistant'),
	body('history.*.content')
		.optional()
		.isString()
		.isLength({ min: 1, max: 1200 })
		.withMessage('history content must be between 1 and 1200 characters'),
];

const enforceAssistantEnabled = (_req, res, next) => {
	if (!isAssistantEnabled()) {
		return res.status(503).json({ message: 'AI assistant is temporarily disabled.' });
	}
	return next();
};

router.post('/chat', auth(), enforceAssistantEnabled, aiLimiter, aiChatValidation, handleValidation, chatWithAssistant);

module.exports = router;
