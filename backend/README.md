# UniConnect Backend

Node.js + Express API powering the UniConnect marketplace, bill sharing, chat, and moderation flows. This service exposes REST + Socket.IO endpoints, integrates with MongoDB, Cloudinary, and the ML microservice, and issues JWT auth tokens.

## Requirements

- Node.js 18+
- MongoDB 6+
- Access to Cloudinary, SMTP credentials, and the ML microservice

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `.env.example` to `.env` and fill in secrets.
3. Start MongoDB and ensure the ML service is running on `ML_SERVICE_URL`.
4. Run in development:
   ```bash
   npm run dev
   ```
5. Production start:
   ```bash
   npm start
   ```
6. Seed sample data:
   ```bash
   npm run seed
   ```

## Testing & Linting

```bash
npm run lint
npm test
```

## Key Features

- JWT access + refresh tokens with email verification hooks (toggle auto-verify for dev via env comment in `authController`).
- Socket.IO real-time chat, typing indicators, read receipts, and auctions in-memory (documented in code for production hardening).
- Cloudinary uploads validated by file type + size (5MB default).
- Moderation middleware calls the ML service for every listing create/update and flags suspicious content for admin review.
- Bill-sharing workflows with equal/custom/percentage splits and helper utilities.
- Comprehensive rate limiting, Helmet, sanitized inputs, and strict CORS using `FRONTEND_URL`.
