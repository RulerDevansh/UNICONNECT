"""Utilities for classifying abusive/banned products in listing images."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Dict

import httpx
import numpy as np
from PIL import Image
from tensorflow import keras
from tensorflow.keras.applications.efficientnet import preprocess_input


CLASS_NAMES = ('negative', 'positive')


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
        return keras.models.load_model(self.model_path)

    def _download_image(self, image_url: str) -> bytes:
        timeout = httpx.Timeout(10.0, read=10.0)
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
        raw = self._download_image(image_url)
        input_tensor = self._preprocess(raw)
        prob = float(self._model.predict(input_tensor, verbose=0)[0][0])
        predicted_class = self.class_names[1] if prob >= 0.5 else self.class_names[0]
        blocked = prob >= self.threshold

        return {
            'filename': image_url,
            'predicted_class': predicted_class,
            'probability': prob,
            'threshold': self.threshold,
            'blocked': blocked,
            'flagged': blocked,
        }
