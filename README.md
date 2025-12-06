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
   # from the repo root
   cd ml_service
   scripts/setup_ml_env.sh                # one-time venv + deps install
   scripts/run_ml_service.sh --reload     # starts FastAPI on port 8001
   ```

   On Windows (PowerShell):
   ```powershell
   cd ml_service
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_ml_env.ps1
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_ml_service.ps1 --reload
   ```

Ensure `backend/.env` sets `ML_SERVICE_URL=http://localhost:8001` so listings and moderation flows reach the service.

## Testing

- Backend: `npm test`
- Frontend: `npm run test`
- ML Service: `pytest`

