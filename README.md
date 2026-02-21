# Reliable Web Push Demo

A minimal Express + Service Worker project that supports:

- Persistent VAPID keys via environment variables.
- Background push delivery (works with tab closed/minimized after subscription).
- Subscription persistence in `subscriptions.json`.

## Setup

```bash
npm install
node scripts/generate-vapid-keys.js
```

Copy `.env.example` to `.env` and paste generated values.

## VAPID env options

You can configure keys either way:

1. Separate env vars:

```env
VAPID_PUBLIC_KEY=...
VAPID_PRIVATE_KEY=...
```

2. Single env var:

```env
VAPID_KEYS={"publicKey":"...","privateKey":"..."}
```

or:

```env
VAPID_KEYS=publicKey:privateKey
```

At startup, the server logs:

- key source
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

## Run

```bash
npm start
```

Open `http://localhost:3000`, click **Enable notifications**, then use **Send push batch**.

## Endpoints

- `GET /api/config` -> public VAPID key and sending limits.
- `POST /api/subscribe` -> save/update browser subscription.
- `POST /api/send` -> send repeated push messages.
