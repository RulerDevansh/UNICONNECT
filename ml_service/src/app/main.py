import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

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

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(name)s %(levelname)s %(message)s')

settings = get_settings()
engine = RecommendationEngine(
    model_path=settings.recommender_model_path,
    data_path=settings.recommender_data_path,
)
logger = logging.getLogger(__name__)

# Alcohol detector is loaded in background after server starts
# so it doesn't block the startup probe.
alcohol_detector = None
_detector_lock = threading.Lock()


def _load_detector_background():
    """Load TF model + warmup in a background thread so the server can serve health checks."""
    global alcohol_detector
    try:
        logger.info('Loading alcohol detector in background...')
        # Defer TF import to avoid slowing down module load / server start
        from .alcohol_detector import AlcoholDetector

        detector = AlcoholDetector(
            model_path=settings.alcohol_model_path,
            threshold=settings.alcohol_threshold,
        )
        detector.warmup()
        with _detector_lock:
            alcohol_detector = detector
        logger.info('Alcohol detector ready')
    except Exception as err:
        logger.warning('Alcohol detector unavailable: %s', err)


@asynccontextmanager
async def lifespan(application: FastAPI):
    # Start loading the TF model in the background
    thread = threading.Thread(target=_load_detector_background, daemon=True)
    thread.start()
    yield
    # Shutdown — nothing to clean up


app = FastAPI(title='UniConnect ML Service', version='1.0.0', lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)


@app.get('/health')
def health():
    with _detector_lock:
        detector_status = 'loaded' if alcohol_detector is not None else 'loading'
    return {
        'status': 'ok',
        'alcohol_detector': detector_status,
    }


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


def _predict_safety(image_url: str) -> AlcoholDetectionResponse:
    with _detector_lock:
        detector = alcohol_detector
    if detector is None:
        logger.warning('Alcohol detector not loaded, returning fallback')
        return {
            'filename': image_url,
            'predicted_class': 'negative',
            'probability': 0.0,
            'threshold': settings.alcohol_threshold,
            'blocked': False,
        }
    return detector.predict_from_url(image_url)


@app.post('/predict/alcohol-image', response_model=AlcoholDetectionResponse)
@app.post('/predict/url', response_model=AlcoholDetectionResponse)
def detect_alcohol(payload: AlcoholDetectionRequest):
    try:
        return _predict_safety(str(payload.image_url))
    except TimeoutError as exc:
        logger.error('Alcohol detection timed out: %s', exc)
        raise HTTPException(status_code=504, detail='Model inference timed out')
    except Exception as exc:
        logger.error('Alcohol detection failed: %s', exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f'Alcohol detection error: {exc}')
