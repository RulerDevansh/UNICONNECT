# UniConnect Backend

Node.js + Express API powering the UniConnect marketplace, bill sharing, chat, and moderation flows. This service exposes REST + Socket.IO endpoints, integrates with MongoDB, Cloudinary, and the ML microservice, and issues JWT auth tokens.

## Requirements

- Node.js 18+
- MongoDB 6+
- Access to Cloudinary, SMTP credentials (Gmail), and the ML microservice

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in secrets.
3. Configure Gmail SMTP (see below).
4. Start MongoDB and ensure the ML service is running on `ML_SERVICE_URL`.
5. Run in development:
   ```bash
   npm run dev
   ```
6. Production start:
   ```bash
   npm start
   ```
7. Seed sample data:
   ```bash
   npm run seed
   ```

## Gmail SMTP Configuration

All emails (OTP verification, password reset) are sent via Gmail SMTP. Add these to `backend/.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-16-char-app-password
```

> Generate an App Password at [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords) after enabling 2-Step Verification. Paste the 16-character password (no spaces) as `SMTP_PASS`.

## Testing & Linting

```bash
npm run lint
npm test
```

## Key Features

- **OTP Email Verification on Registration** — a 6-digit code (valid 10 min, generated with `crypto.randomInt`) is emailed on every registration. Users must verify before logging in.
- **OTP-based Forgot / Reset Password** — `POST /api/auth/forgot-password` emails a reset OTP; `POST /api/auth/reset-password` validates code, updates password, and clears all refresh tokens.
- JWT access + refresh tokens with secure rotation.
- Socket.IO real-time chat, typing indicators, read receipts, and auctions in-memory.
- Cloudinary uploads validated by file type + size (5 MB default).
- Moderation middleware calls the ML service for every listing create/update and flags suspicious content for admin review.
- Bill-sharing workflows with equal/custom/percentage splits and helper utilities.
- Comprehensive rate limiting, Helmet, sanitized inputs, and strict CORS using `FRONTEND_URL`.

## Auth API Endpoints

| Method | Route | Description |
|--------|-------------------------------------------------------|---------------------------------------------|
| POST | `/api/auth/register` | Register — sends OTP to email |
| POST | `/api/auth/verify-email` | Verify registration OTP |
| POST | `/api/auth/resend-verification` | Resend registration OTP |
| POST | `/api/auth/login` | Login (verified accounts only) |
| POST | `/api/auth/refresh` | Refresh access token |
| POST | `/api/auth/logout` | Invalidate refresh token |
| POST | `/api/auth/forgot-password` | Send password-reset OTP to email |
| POST | `/api/auth/reset-password` | Reset password using OTP |

