# UniConnect Frontend

React + Vite + Tailwind client for the UniConnect marketplace, chat, and bill-sharing experience.

## Setup

```bash
npm install
npm run dev
```

Environment variables live in `.env` (copy `.env.example`).

- `VITE_API_URL` should point to the backend `/api` base.
- `VITE_SOCKET_URL` should match the backend Socket.IO origin.
- `VITE_CLOUDINARY_UPLOAD_PRESET` is optional if you use unsigned uploads.

## Available Scripts

- `npm run dev`: start Vite dev server with hot reload
- `npm run build`: production bundle
- `npm run preview`: preview build
- `npm run lint`: run ESLint
- `npm test`: execute Vitest + Testing Library suites

## Testing

Component tests live under `src/tests`. Use Vitest snapshots sparingly; prefer behavioral assertions to keep the suite resilient.
