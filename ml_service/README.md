# UniConnect ML Service

FastAPI microservice powering moderation and recommendation features for the UniConnect platform.

## Features

- **Content-based recommendations**: Uses TF-IDF + Nearest Neighbors over sample listings.
- **Keyword moderation**: Simple rule-based scoring for prohibited content.
- **HTTP API**:
  - `GET /health`
  - `POST /predict/recommendations`
  - `POST /predict/moderation`
- **Training script**: `scripts/train_recommender.py` regenerates the recommender artifact.
- **Tests**: `pytest` suite exercises the public endpoints.

## Getting Started

```bash
cd ml_service
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/train_recommender.py
uvicorn src.app.main:app --reload --port 8001
```

> **IDE tip**: When using VS Code or Pyright, select the `ml_service/.venv` interpreter (or run `Python: Select Interpreter`) so the language server picks up installed packages.

Environment variables (optional):

- `RECOMMENDER_MODEL_PATH` – override artifact path (default `artifacts/recommender.joblib`).
- `ML_SERVICE_HOST` / `ML_SERVICE_PORT` – tweak host/port when embedding elsewhere.

## API Examples

### Recommendations

```bash
curl -X POST http://localhost:8001/predict/recommendations \
  -H 'Content-Type: application/json' \
  -d '{"userId":"123","recent_item_ids":["L1","L5"],"limit":3}'
```

### Moderation

```bash
curl -X POST http://localhost:8001/predict/moderation \
  -H 'Content-Type: application/json' \
  -d '{"title":"Selling fake IDs","description":"Brand new counterfeit gear"}'
```

## Tests

```bash
cd ml_service
pytest
```

## Integration Notes

Set `ML_SERVICE_URL=http://localhost:8001` in the backend `.env`. The Express server already proxies `/api/ml/*` calls to this service.
