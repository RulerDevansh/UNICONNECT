# UniConnect ML Service

FastAPI microservice powering moderation and recommendation features for the UniConnect platform.

## Features

- **Content-based recommendations**: Uses TF-IDF + Nearest Neighbors over sample listings.
- **Keyword moderation**: Simple rule-based scoring for prohibited content.
- **Alcohol image policy**: Loads a Keras `.h5` classifier to block beer bottles before listings publish.
- **HTTP API**:
  - `GET /health`
  - `POST /predict/recommendations`
  - `POST /predict/moderation`
  - `POST /predict/alcohol-image`
- **Training script**: `scripts/train_recommender.py` regenerates the recommender artifact.
- **Tests**: `pytest` suite exercises the public endpoints.

## Getting Started

```bash
# run everything inside the ml_service folder
cd ml_service
scripts/setup_ml_env.sh                # creates .venv and installs deps
# optional: regenerate recommender artifact
./.venv/bin/python scripts/train_recommender.py
# start the FastAPI server (honors ML_SERVICE_HOST/PORT)
scripts/run_ml_service.sh --reload
```

> **IDE tip**: When using VS Code or Pyright, select the `ml_service/.venv` interpreter (or run `Python: Select Interpreter`) so the language server picks up installed packages.

Environment variables (optional):

- `RECOMMENDER_MODEL_PATH` – override artifact path (default `artifacts/recommender.joblib`).
- `RECOMMENDER_DATA_PATH` – CSV used to bootstrap the recommender (default `data/sample_listings.csv`).
- `ALCOHOL_MODEL_PATH` – override path to the alcohol detector (default `AlchoholDetector.h5`).
- `ALCOHOL_THRESHOLD` – confidence needed before flagging a beer bottle (default `0.7`).
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

### Alcohol Image Detection

```bash
curl -X POST http://localhost:8001/predict/alcohol-image \
  -H 'Content-Type: application/json' \
  -d '{"image_url":"https://cdn.example.com/listing.jpg"}'
```

Response:

```json
{
  "predicted_label": "Beer Bottle",
  "confidence": 0.93,
  "scores": {
    "Beer Bottle": 0.93,
    "Plastic Bottle": 0.07
  },
  "flagged": true,
  "is_beer": true
}
```

> `is_beer` flips to `true` only when the predicted label is “Beer Bottle” **and** its confidence meets `ALCOHOL_THRESHOLD`. The backend blocks those listings immediately while keeping the legacy `flagged` field for backward compatibility.

## Tests

```bash
cd ml_service
pytest
```

## Integration Notes

Set `ML_SERVICE_URL=http://localhost:8001` in the backend `.env`. The Express server already proxies `/api/ml/*` calls to this service.
