"""Utilities for classifying alcohol-related bottles in listing images."""

from __future__ import annotations

import io
from pathlib import Path
from typing import Dict, List

import httpx
import numpy as np
from PIL import Image
import h5py

from tensorflow import keras
from tensorflow.keras.applications.inception_v3 import InceptionV3
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D


class AlcoholDetector:
    """Thin wrapper around the Keras model backing `/predict/alcohol-image`."""

    def __init__(
        self,
        model_path: str | Path,
        *,
        threshold: float = 0.7,
        class_labels: List[str] | None = None,
        target_size: tuple[int, int] = (300, 300),
    ) -> None:
        self.model_path = Path(model_path)
        self.threshold = threshold
        self.class_labels = class_labels or ['Plastic Bottle', 'Beer Bottle']
        self.target_size = target_size
        self._model = self._load_model()

    def _load_model(self):
        if not self.model_path.exists():
            raise FileNotFoundError(f'Alcohol model not found at {self.model_path}')
        input_shape = (*self.target_size, 3)
        base_model = InceptionV3(weights=None, include_top=False, input_shape=input_shape)
        model = keras.Sequential(
            [
                base_model,
                GlobalAveragePooling2D(name='global_average_pooling2d'),
                Dropout(0.15, name='dropout'),
                Dense(1024, activation='relu', name='dense'),
                Dense(len(self.class_labels), activation='softmax', name='dense_1'),
            ],
            name='alcohol_detector',
        )
        self._assign_checkpoint_weights(model)
        return model

    def _assign_checkpoint_weights(self, model: keras.Model) -> None:
        """Load weights from the legacy `.h5` checkpoint by matching tensor names."""

        with h5py.File(self.model_path, 'r') as h5file:
            weight_root = h5file.get('model_weights', h5file)
            tensor_bank: Dict[str, np.ndarray] = {}

            def _harvest(prefix: str, group: h5py.Group) -> None:
                for name, value in group.items():
                    if isinstance(value, h5py.Group):
                        _harvest(f'{prefix}{name}/', value)
                    else:
                        tensor_bank[f'{prefix}{name}'] = value[()]

            for layer_name, layer_group in weight_root.items():
                if isinstance(layer_group, h5py.Group):
                    _harvest(f'{layer_name}/', layer_group)

        assigned = 0
        for weight in model.weights:
            key = self._weight_to_checkpoint_key(weight)
            if key not in tensor_bank:
                continue
            value = tensor_bank[key]
            if value.shape != tuple(weight.shape):
                continue
            weight.assign(value)
            assigned += 1

        if assigned == 0:
            raise ValueError('No weights were loaded from the checkpoint; tensor names may not match.')

    @staticmethod
    def _weight_to_checkpoint_key(weight) -> str:
        """Map a TensorFlow weight tensor to its legacy HDF5 dataset name."""

        path = weight.path  # e.g., "conv2d/kernel" or "sequential/dense/kernel"
        suffix = ':0'
        if path.startswith('sequential/'):
            normalized = path.split('/', 1)[1]
            layer_name = normalized.split('/', 1)[0]
            return f'{layer_name}/{normalized}{suffix}'
        return f'inception_v3/{path}{suffix}'

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
        image = image.resize(self.target_size)
        array = np.asarray(image, dtype=np.float32) / 255.0
        return np.expand_dims(array, axis=0)

    def predict_from_url(self, image_url: str) -> Dict[str, object]:
        if not isinstance(image_url, str):
            image_url = str(image_url)
        raw = self._download_image(image_url)
        input_tensor = self._preprocess(raw)
        predictions = self._model.predict(input_tensor, verbose=0)[0]
        # Some exported graphs emit plain floats instead of numpy arrays; normalize shape.
        predictions = np.array(predictions, dtype=np.float32).flatten()
        if len(predictions) != len(self.class_labels):
            raise ValueError('Model output mismatch: expected %d classes, got %d' % (len(self.class_labels), len(predictions)))

        scores = {
            label: float(prob)
            for label, prob in zip(self.class_labels, predictions)
        }

        best_idx = int(np.argmax(predictions))
        predicted_label = self.class_labels[best_idx]
        confidence = float(predictions[best_idx])

        beer_score = float(scores.get('Beer Bottle', scores.get('beer bottle', 0.0)))
        is_beer = beer_score >= self.threshold

        # Policy note: beer bottles must be blocked immediately, so `flagged` mirrors `is_beer`.
        return {
            'predicted_label': predicted_label,
            'confidence': confidence,
            'scores': scores,
            'flagged': is_beer,
            'is_beer': is_beer,
        }
