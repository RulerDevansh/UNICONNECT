const axios = require('axios');

const withRetry = async (fn, attempts = 3) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
      }
    }
  }
  throw lastError;
};

const BEER_BLOCK_REASON = 'beer_bottle_detected';
const BEER_BLOCK_RECOMMENDATION = 'Beer bottles are not allowed on UniConnect. Please remove the image or request admin review if this is a mistake.';

const normalizeAlcoholResponse = (data = {}) => {
  const predictedLabel = data.predicted_class || data.predicted_label || '';
  const confidence = Number(data.probability ?? data.confidence ?? 0);
  const blocked = Boolean(
    data.blocked
    ?? data.is_beer
    ?? (data.flagged && /beer|positive/i.test(predictedLabel))
  );

  return {
    blocked,
    predictedLabel,
    confidence: Number.isFinite(confidence) ? confidence : 0,
    threshold: data.threshold,
  };
};

const callModeration = async (payload) => {
  if (!process.env.ML_SERVICE_URL) return { flagged: false, score: 0 };
  try {
    const data = await withRetry(() =>
      axios
        .post(`${process.env.ML_SERVICE_URL}/predict/moderation`, payload, { timeout: 5000 })
        .then((res) => res.data)
    );
    console.info('[ML] moderation result', data);
    return data;
  } catch {
    return { flagged: false, score: 0, reason: 'ml_unreachable' };
  }
};

const checkAlcoholImage = async (imageUrl) => {
  if (!process.env.ML_SERVICE_URL || !imageUrl) {
    return { blocked: false, reason: 'ml_disabled' };
  }

  try {
    const data = await withRetry(() =>
      axios
        .post(
          `${process.env.ML_SERVICE_URL}/predict/url`,
          { image_url: imageUrl },
          { timeout: 30000 }
        )
        .then((res) => res.data),
      1
    );

    const { blocked, predictedLabel, confidence, threshold } = normalizeAlcoholResponse(data);

    console.info('[ML] alcohol prediction', {
      predicted_class: predictedLabel,
      probability: confidence,
      threshold,
      blocked,
    });

    return {
      blocked,
      reason: blocked ? BEER_BLOCK_REASON : 'clear',
      predicted_label: predictedLabel,
      confidence,
      flagged: blocked,
      needs_review: false,
      recommendation: blocked ? BEER_BLOCK_RECOMMENDATION : null,
    };
  } catch {
    return {
      blocked: false,
      needs_review: true,
      error: 'ml_unreachable',
    };
  }
};

const proxyRecommendations = async (payload) =>
  withRetry(() =>
    axios
      .post(`${process.env.ML_SERVICE_URL}/predict/recommendations`, payload, { timeout: 5000 })
      .then((res) => res.data)
  );

module.exports = { callModeration, checkAlcoholImage, proxyRecommendations };
