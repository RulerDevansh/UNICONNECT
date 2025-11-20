from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .moderation import score_listing
from .recommender import RecommendationEngine
from .schemas import ModerationRequest, ModerationResponse, RecommendationRequest, RecommendationResponseItem

settings = get_settings()
engine = RecommendationEngine(model_path=settings.recommender_model_path)

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
    return score_listing(payload.title, payload.description)
