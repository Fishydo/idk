# Reliable Web Push Demo

A minimal Express + Service Worker project that supports:

- Persistent VAPID keys via environment variables.
- Background push delivery (works with tab closed/minimized after subscription).
- Controlled repeated sends (`count`, `intervalMs`) with per-notification random `nonce` + URL.
- Subscription persistence in `subscriptions.json`.

## Setup

```bash
npm install
node scripts/generate-vapid-keys.js
```

Copy `.env.example` to `.env` and paste generated values.

> Note: This project logs VAPID keys at startup because you explicitly requested that behavior.

## Run

```bash
npm start
```

Open `http://localhost:3000`, click **Enable notifications**, then use **Send push batch**.

## Endpoints

- `GET /api/config` -> public VAPID key and sending limits.
- `POST /api/subscribe` -> save/update browser subscription.
- `POST /api/send` -> send repeated push messages.
