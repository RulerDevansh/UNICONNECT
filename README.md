# UniConnect Monorepo

Full-stack campus marketplace featuring:

- **Backend** (`backend/`): Express + MongoDB REST API with Socket.IO chat, moderation, offers, and bill sharing.
- **Frontend** (`frontend/`): React + Vite + Tailwind client with listing workflows, chat UI, and admin dashboard.
- **ML Service** (`ml_service/`): FastAPI microservice handling recommendations and moderation heuristics.

## Local Development

1. **Backend**
   ```bash
   cd backend
   npm install
   npm run dev
   ```
2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. **ML Service**
   ```bash
   cd ml_service
   python -m venv .venv && source .venv/bin/activate
   pip install -r requirements.txt
   python scripts/train_recommender.py
   uvicorn src.app.main:app --reload --port 8001
   ```

Ensure `backend/.env` sets `ML_SERVICE_URL=http://localhost:8001` so listings and moderation flows reach the service.

## Testing

- Backend: `npm test`
- Frontend: `npm run test`
- ML Service: `pytest`

## Deployment Notes

Treat each folder as an independent deployment unit. Containerization is recommended:

- Backend: Node 18-alpine image, run `npm ci && npm run build && npm start`.
- Frontend: Build with `npm run build`, serve `dist/` via static hosting (Vercel, Netlify, S3+CloudFront).
- ML Service: Python 3.11 slim image with `pip install -r requirements.txt` and start via `uvicorn src.app.main:app --host 0.0.0.0 --port 8001`.

CI/CD hooks can run each folder's tests in parallel for faster feedback.
