"""Train a lightweight content-based recommender for UniConnect listings."""
from __future__ import annotations

import sys
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from src.app.config import get_settings  # noqa: E402

settings = get_settings()
DATA_PATH = Path(settings.recommender_data_path)
ARTIFACT_PATH = Path(settings.recommender_model_path)


def train():
    df = pd.read_csv(DATA_PATH)
    if 'text_blob' not in df.columns:
        df['text_blob'] = df[['title', 'description', 'tags']].fillna('').agg(' '.join, axis=1)
    vectorizer = TfidfVectorizer(stop_words='english')
    matrix = vectorizer.fit_transform(df['text_blob'])
    nn = NearestNeighbors(metric='cosine', algorithm='brute')
    nn.fit(matrix)
    ARTIFACT_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump({'vectorizer': vectorizer, 'nn': nn, 'listings': df}, ARTIFACT_PATH)
    print(f'Saved recommender to {ARTIFACT_PATH.resolve()}')


if __name__ == '__main__':
    train()
