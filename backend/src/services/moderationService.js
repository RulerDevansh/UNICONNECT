const axios = require('axios');

const withRetry = async (fn, attempts = 3) => {
  let lastError;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      await new Promise((resolve) => setTimeout(resolve, 200 * (i + 1)));
    }
  }
  throw lastError;
};

const BEER_BLOCK_REASON = 'beer_bottle_detected';
const BEER_BLOCK_MESSAGE = 'Beer bottles are not allowed to be listed. Contact admin if this is incorrect.';

const callModeration = async (payload) => {
  if (!process.env.ML_SERVICE_URL) return { flagged: false, score: 0 };
  try {
    const data = await withRetry(() =>
      axios
        .post(`${process.env.ML_SERVICE_URL}/predict/moderation`, payload, { timeout: 5000 })
        .then((res) => res.data)
    );
    return data;
  } catch (err) {
    console.error('Moderation call failed', err.message);
    return { flagged: false, score: 0, reason: 'ml_unreachable' };
  }
};

const checkAlcoholImage = async (imageUrl) => {
  if (!process.env.ML_SERVICE_URL || !imageUrl) {
    return { blocked: false, reason: 'ml_disabled' };
  }

  // Recommended behavior: block immediately and show a friendly error to the seller.
  try {
    const data = await withRetry(() =>
      axios
        .post(
          `${process.env.ML_SERVICE_URL}/predict/url`,
          { image_url: imageUrl },
          { timeout: 8000 }
        )
        .then((res) => res.data)
    );

    const predictedClass = data?.predicted_class || '';
    const probability = Number(data?.probability ?? 0);
    const blocked = Boolean(data?.blocked);

    console.info('[ML] alcohol prediction', {
      filename: data?.filename,
      predicted_class: predictedClass,
      probability,
      threshold: data?.threshold,
      blocked,
    });

    return {
      blocked,
      reason: blocked ? BEER_BLOCK_REASON : 'clear',
      predicted_label: predictedClass,
      confidence: probability,
      flagged: blocked,
      is_beer: blocked,
      scores: {},
      probability,
      filename: data?.filename,
      recommendation: BEER_BLOCK_MESSAGE,
      needs_review: false,
    };
  } catch (err) {
    console.error('Alcohol detection call failed', err.message);
    return {
      blocked: false,
      needs_review: true,
      error: 'ml_unreachable',
      recommendation: BEER_BLOCK_MESSAGE,
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
