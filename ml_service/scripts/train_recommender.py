"""Train a lightweight content-based recommender for UniConnect listings."""
from pathlib import Path

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors

DATA_PATH = Path('data/sample_listings.csv')
ARTIFACT_PATH = Path('artifacts/recommender.joblib')


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
