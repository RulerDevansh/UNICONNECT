const { generateAssistantReply } = require('../services/aiService');

const chatWithAssistant = async (req, res, next) => {
  try {
    const { message, history = [] } = req.body;
    const result = await generateAssistantReply({
      user: req.user,
      message,
      history,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};

module.exports = { chatWithAssistant };
