import logging

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .alcohol_detector import AlcoholDetector
from .config import get_settings
from .moderation import score_listing
from .recommender import RecommendationEngine
from .schemas import (
    AlcoholDetectionRequest,
    AlcoholDetectionResponse,
    ModerationRequest,
    ModerationResponse,
    RecommendationRequest,
    RecommendationResponseItem,
)

settings = get_settings()
engine = RecommendationEngine(
    model_path=settings.recommender_model_path,
    data_path=settings.recommender_data_path,
)
logger = logging.getLogger(__name__)

try:
    alcohol_detector = AlcoholDetector(
        model_path=settings.alcohol_model_path,
        threshold=settings.alcohol_threshold,
    )
except Exception as err:  # pragma: no cover - logged for observability, service stays up.
    logger.warning('Alcohol detector unavailable: %s', err)
    alcohol_detector = None

app = FastAPI(title='UniConnect ML Service', version='1.0.0')
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    return {'status': 'ok'}


@app.post('/predict/recommendations', response_model=list[RecommendationResponseItem])
def recommend(payload: RecommendationRequest):
    return engine.recommend(payload.recent_item_ids, payload.limit)


@app.post('/predict/moderation', response_model=ModerationResponse)
def moderate(payload: ModerationRequest):
    base_text = payload.text
    if not base_text:
        title = payload.title or ''
        description = payload.description or ''
        base_text = f"{title} {description}".strip()
    if not base_text:
        raise HTTPException(status_code=422, detail='title/description/text required')
    return score_listing(base_text, '')


@app.post('/predict/alcohol-image', response_model=AlcoholDetectionResponse)
def detect_alcohol(payload: AlcoholDetectionRequest):
    if alcohol_detector is None:
        return {
            'predicted_label': 'Unknown',
            'confidence': 0.0,
            'scores': {},
            'flagged': False,
            'is_beer': False,
        }

    result = alcohol_detector.predict_from_url(payload.image_url)
    # Policy: beer bottles (above threshold) must be blocked immediately, so `flagged` mirrors `is_beer`.
    result['flagged'] = bool(result.get('is_beer', False))
    return result
