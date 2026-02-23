"""Utilities for classifying abusive/banned products in listing images."""

from __future__ import annotations

import io
import logging
from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout
from pathlib import Path
from typing import Dict

import httpx
import numpy as np
from PIL import Image
from tensorflow import keras
from tensorflow.keras.applications.efficientnet import preprocess_input

logger = logging.getLogger(__name__)

CLASS_NAMES = ('negative', 'positive')

# Shared thread pool for TF inference (single worker to avoid TF threading issues)
_executor = ThreadPoolExecutor(max_workers=1)

# Default prediction timeout in seconds
PREDICT_TIMEOUT = 60


class AlcoholDetector:
    """Classifier that predicts whether an image contains a banned product."""

    def __init__(
        self,
        model_path: str | Path,
        *,
        threshold: float = 0.5,
        image_size: int = 224,
        class_names: tuple[str, str] = CLASS_NAMES,
    ) -> None:
        self.model_path = Path(model_path)
        self.threshold = threshold
        self.image_size = image_size
        self.class_names = class_names
        self._model = self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f'Alcohol model not found at {self.model_path}')
        model = keras.models.load_model(self.model_path)
        logger.info('Alcohol model loaded from %s', self.model_path)
        return model

    def warmup(self) -> None:
        """Run a dummy prediction to compile the TF graph."""
        logger.info('Running warmup prediction...')
        dummy = np.zeros((1, self.image_size, self.image_size, 3), dtype=np.float32)
        self._model.predict(dummy, verbose=0)
        logger.info('Warmup prediction complete')

    def _download_image(self, image_url: str) -> bytes:
        timeout = httpx.Timeout(15.0, read=15.0)
        headers = {
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 '
                          '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
        with httpx.Client(timeout=timeout, follow_redirects=True, headers=headers) as client:
            response = client.get(image_url)
            response.raise_for_status()
            return response.content

    def _preprocess(self, image_bytes: bytes) -> np.ndarray:
        image = Image.open(io.BytesIO(image_bytes)).convert('RGB')
        image = image.resize((self.image_size, self.image_size))
        array = np.asarray(image, dtype=np.float32)
        array = np.expand_dims(array, axis=0)
        return preprocess_input(array)

    def predict_from_url(self, image_url: str) -> Dict[str, object]:
        if not isinstance(image_url, str):
            image_url = str(image_url)

        logger.info('Alcohol detection request for: %s', image_url)

        try:
            raw = self._download_image(image_url)
            logger.info('Image downloaded (%d bytes)', len(raw))
        except Exception as exc:
            logger.error('Image download failed: %s', exc)
            raise

        input_tensor = self._preprocess(raw)
        logger.info('Image preprocessed, running inference...')

        # Run inference with a timeout to prevent hanging on slow hardware
        future = _executor.submit(self._model.predict, input_tensor, verbose=0)
        try:
            prediction = future.result(timeout=PREDICT_TIMEOUT)
        except FuturesTimeout:
            logger.error('TF inference timed out after %ds', PREDICT_TIMEOUT)
            future.cancel()
            raise TimeoutError(f'Inference timed out after {PREDICT_TIMEOUT}s')

        prob = float(prediction[0][0])
        predicted_class = self.class_names[1] if prob >= 0.5 else self.class_names[0]
        blocked = prob >= self.threshold

        logger.info(
            'Prediction complete: class=%s prob=%.4f blocked=%s',
            predicted_class, prob, blocked,
        )

        return {
            'filename': image_url,
            'predicted_class': predicted_class,
            'probability': prob,
            'threshold': self.threshold,
            'blocked': blocked,
            'flagged': blocked,
        }
