import logging
import threading
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .moderation import score_listing
from .recommender import RecommendationEngine
from ..location_utils import find_nearest_by_location, haversine_distance, kmeans_clustering
from .schemas import (
    AlcoholDetectionRequest,
    AlcoholDetectionResponse,
    LocationBasedRecommendationRequest,
    LocationBasedRecommendationResponse,
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


@app.post('/predict/location-based-recommendations', response_model=list[LocationBasedRecommendationResponse])
def recommend_by_location(payload: LocationBasedRecommendationRequest):
    """
    Recommend listings and shares based on user location using Haversine distance.
    Returns items sorted by distance from user location.
    """
    try:
        recommendations = []

        def _cluster_and_rank(items):
            if not items:
                return []

            user_location = {
                'latitude': payload.user_location.latitude,
                'longitude': payload.user_location.longitude,
            }

            points = []
            for item in items:
                location = item.get('location') or {}
                latitude = location.get('latitude')
                longitude = location.get('longitude')
                if latitude is None or longitude is None:
                    continue
                points.append({
                    **item,
                    'latitude': latitude,
                    'longitude': longitude,
                })

            if not points:
                return []

            cluster_count = min(3, len(points))
            clusters = kmeans_clustering(points, k=cluster_count, max_iterations=10)

            nearest_cluster = None
            nearest_distance = float('inf')
            for cluster in clusters:
                if not cluster:
                    continue
                centroid_lat = sum(p['latitude'] for p in cluster) / len(cluster)
                centroid_lon = sum(p['longitude'] for p in cluster) / len(cluster)
                distance = haversine_distance(
                    user_location['latitude'],
                    user_location['longitude'],
                    centroid_lat,
                    centroid_lon,
                )
                if distance < nearest_distance:
                    nearest_distance = distance
                    nearest_cluster = cluster

            cluster_items = nearest_cluster or points
            return find_nearest_by_location(user_location, cluster_items, payload.max_distance_km)

        # Process listings
        if payload.listings:
            nearby_listings = _cluster_and_rank(payload.listings)
            for listing in nearby_listings[:payload.limit]:
                recommendations.append(
                    LocationBasedRecommendationResponse(
                        type='listing',
                        id=str(listing.get('_id', listing.get('id', ''))),
                        title=listing.get('title', ''),
                        distance_km=listing['distance_km'],
                        category=listing.get('category'),
                    )
                )

        # Process shares
        if payload.shares:
            nearby_shares = _cluster_and_rank(payload.shares)
            for share in nearby_shares[:payload.limit]:
                recommendations.append(
                    LocationBasedRecommendationResponse(
                        type='share',
                        id=str(share.get('_id', share.get('id', ''))),
                        title=share.get('name', ''),
                        distance_km=share['distance_km'],
                        category=share.get('shareType'),
                    )
                )

        # Sort all recommendations by distance and limit
        recommendations.sort(key=lambda x: x.distance_km)
        return recommendations[:payload.limit]

    except Exception as exc:
        logger.error('Location-based recommendation error: %s', exc, exc_info=True)
        raise HTTPException(status_code=500, detail=f'Recommendation error: {exc}')
