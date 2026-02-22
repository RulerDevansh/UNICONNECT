from pathlib import Path
from typing import List

import joblib
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.neighbors import NearestNeighbors


class RecommendationEngine:
  def __init__(self, model_path: str, data_path: str):
    self.model_path = Path(model_path)
    self.data_path = Path(data_path)
    self.vectorizer = None
    self.nn_model = None
    self.listings = None
    self._load()

  def _load(self):
    if self.model_path.exists():
      artifact = joblib.load(self.model_path)
      self.vectorizer = artifact['vectorizer']
      self.nn_model = artifact['nn']
      self.listings = artifact['listings']
      return
    self.listings = pd.read_csv(self.data_path)
    corpus = self.listings['text_blob'].tolist()
    self.vectorizer = TfidfVectorizer(stop_words='english')
    matrix = self.vectorizer.fit_transform(corpus)
    self.nn_model = NearestNeighbors(metric='cosine', algorithm='brute')
    self.nn_model.fit(matrix)

  def recommend(self, recent_ids: List[str], limit: int = 5):
    if self.listings is None or self.vectorizer is None:
      return []
    if not recent_ids:
      head = self.listings.head(limit)
      return [
        {
          'id': row['listing_id'],
          'score': float(row.get('popularity', 0.5)),
          'title': row['title'],
          'category': row['category'],
        }
        for _, row in head.iterrows()
      ]
    rows = self.listings[self.listings['listing_id'].isin(recent_ids)]
    if rows.empty:
      return self.recommend([], limit)
    corpus = rows['text_blob'].tolist()
    query_vec = self.vectorizer.transform([' '.join(corpus)])
    distances, indices = self.nn_model.kneighbors(query_vec, n_neighbors=min(limit + len(recent_ids), len(self.listings)))
    suggestions = []
    for dist, idx in zip(distances[0], indices[0]):
      listing = self.listings.iloc[idx]
      if listing['listing_id'] in recent_ids:
        continue
      score = float(1 - dist)
      suggestions.append({
        'id': listing['listing_id'],
        'score': round(score, 4),
        'title': listing['title'],
        'category': listing['category'],
      })
      if len(suggestions) >= limit:
        break
    return suggestions
