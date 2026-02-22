# UniConnect

> A full-stack campus marketplace platform for college students — buy, sell, bid, split bills, chat, and more.

---

## What is UniConnect?

UniConnect is an all-in-one campus platform where students can:
- List and discover second-hand items on a marketplace
- Place bids on listings in real-time auctions
- Share bills and expenses with fellow students
- Chat directly with buyers/sellers
- Get AI-powered listing recommendations
- Manage their account securely with OTP-based email verification and password reset

---

## Features

### 🛒 Marketplace & Listings
- Browse and search listings by category, tags, price range, and college domain
- Create listings with up to 5 images (uploaded to Cloudinary, max 5 MB each)
- Edit and delete your own listings
- Listing detail page with full info, images, and seller contact
- Listings are filtered to show content relevant to the user's college domain

### 🔨 Bidding / Auctions
- Place bids on listings that have auctions enabled
- Real-time bidding status via Socket.IO
- Bidding managed in-memory with Socket-based live updates

### 💬 Real-time Chat
- One-on-one chat between buyers and sellers
- Typing indicators and read receipts
- Chat history persisted in MongoDB
- Powered by Socket.IO

### 🧾 Bill Sharing
- Create a bill-share group for splitting shared expenses
- Support for **equal**, **custom amount**, and **percentage** splits
- Members can request to join a share group
- Owner can approve or reject join requests
- Finalize a share to lock in the split amounts
- View all your active and past shares

### 🔔 Notifications
- In-app notifications for bids, offers, chat messages, and share updates
- Real-time delivery via Socket.IO

### 💼 Offers
- Make and receive offers on listings
- Accept or reject incoming offers

### 🤖 AI Recommendations (ML Service)
- FastAPI microservice provides personalized listing recommendations
- Moderation heuristics flag suspicious or policy-violating listings automatically before admin review
- Trained recommender model (`recommender.joblib`)

### 🛡️ Admin Dashboard
- View and manage flagged/reported listings
- Moderate users and content
- Overview of platform activity

### 📊 Reports
- Users can report listings or other users
- Admins can view and act on reports

### 👤 User Profile & History
- View and edit your profile (name, avatar, preferences)
- Transaction history and past listings

---

## 🔐 Authentication & Security

### Registration with OTP Email Verification
- On sign-up, a **6-digit OTP** is generated via `crypto.randomInt` and emailed to the user (Gmail SMTP)
- OTP expires in **10 minutes**
- User must verify their email before they can log in
- Resend OTP available on the verification page
- Endpoints: `POST /api/auth/verify-email`, `POST /api/auth/resend-verification`

### Forgot / Reset Password (OTP-based)
- "Forgot password?" link on the Login page
- User enters registered email → 6-digit reset OTP is emailed
- Enter code + new password + confirm password to reset
- All active sessions (refresh tokens) are invalidated on reset
- Endpoints: `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`

### General Security
- JWT access tokens (short-lived) + refresh tokens (rotation supported)
- Passwords hashed with bcrypt (salt rounds: 10)
- Rate limiting on all routes (`express-rate-limit`)
- Helmet for HTTP security headers
- XSS sanitization middleware
- Strict CORS using `FRONTEND_URL` env variable
- Input validation with `express-validator`

---

## Tech Stack

| Layer | Technology |
|------------|----------------------------------------------|
| Frontend | React 18, Vite, Tailwind CSS, React Router v6 |
| Backend | Node.js, Express, Socket.IO |
| Database | MongoDB (Mongoose) |
| Auth | JWT (access + refresh), bcrypt |
| Email | Nodemailer + Gmail SMTP |
| Storage | Cloudinary (images) |
| ML Service | Python, FastAPI, scikit-learn, Keras |
| Testing | Jest (backend), Vitest (frontend), pytest (ML) |

---

## Project Structure

```
BTP_2025/
├── backend/          # Express REST API + Socket.IO
│   ├── src/
│   │   ├── controllers/   # Route logic
│   │   ├── models/        # Mongoose schemas
│   │   ├── routes/        # API route definitions
│   │   ├── services/      # Email, socket, moderation, cleanup
│   │   ├── middlewares/   # Auth, rate limit, XSS, validation
│   │   ├── config/        # DB, JWT, Cloudinary config
│   │   └── utils/         # Pagination, validators, split calculator
├── frontend/         # React + Vite client
│   ├── src/
│   │   ├── pages/         # All page components
│   │   ├── components/    # Shared UI components
│   │   ├── context/       # Auth context
│   │   ├── services/      # API service functions
│   │   └── hooks/         # Custom React hooks
└── ml_service/       # FastAPI ML microservice
    ├── src/app/       # API endpoints
    ├── scripts/       # Setup + run scripts (bash & PowerShell)
    ├── artifacts/     # Trained model files
    └── data/          # Sample data
```

---

## Local Development

### Prerequisites
- Node.js 18+
- MongoDB 6+
- Python 3.10+
- A Gmail account with 2-Step Verification + App Password

### 1. Backend
```bash
cd backend
npm install
# configure backend/.env (see below)
npm run dev
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
```

### 3. ML Service
```bash
cd ml_service
# Linux/macOS
scripts/setup_ml_env.sh
scripts/run_ml_service.sh --reload

# Windows (PowerShell)
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup_ml_env.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run_ml_service.ps1 --reload
```

---

## Environment Variables (`backend/.env`)

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
JWT_REFRESH_SECRET=your_refresh_secret
FRONTEND_URL=http://localhost:5173

CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Gmail SMTP — use an App Password, not your Google account password
# Get one at: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password

ML_SERVICE_URL=http://localhost:8001

RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=120
```

---

## Auth API Reference

| Method | Endpoint | Auth Required | Description |
|--------|----------------------------------|---------------|-------------------------------|
| POST | `/api/auth/register` | No | Register — sends OTP to email |
| POST | `/api/auth/verify-email` | No | Verify registration OTP |
| POST | `/api/auth/resend-verification` | No | Resend registration OTP |
| POST | `/api/auth/login` | No | Login (verified users only) |
| POST | `/api/auth/refresh` | No | Refresh access token |
| POST | `/api/auth/logout` | No | Clear refresh token |
| POST | `/api/auth/forgot-password` | No | Send password-reset OTP |
| POST | `/api/auth/reset-password` | No | Reset password with OTP |

---

## Testing

```bash
# Backend
cd backend && npm test

# Frontend
cd frontend && npm run test

# ML Service
cd ml_service && pytest
```

---

## Seed Data

```bash
cd backend && npm run seed
```

