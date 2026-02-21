import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import express from 'express';
import webpush from 'web-push';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

const PORT = Number(process.env.PORT || 3000);
const CONTACT_EMAIL = process.env.VAPID_CONTACT_EMAIL || 'mailto:admin@example.com';
const MAX_SPAM_COUNT = Number(process.env.MAX_SEND_COUNT || 20);
const DEFAULT_INTERVAL_MS = Number(process.env.DEFAULT_INTERVAL_MS || 1000);
const subscriptionsPath = path.join(__dirname, 'subscriptions.json');

function resolveVapidKeys() {
  const directPublic = process.env.VAPID_PUBLIC_KEY?.trim();
  const directPrivate = process.env.VAPID_PRIVATE_KEY?.trim();

  if (directPublic && directPrivate) {
    return {
      source: 'VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY',
      publicKey: directPublic,
      privateKey: directPrivate
    };
  }

  const bundled = process.env.VAPID_KEYS?.trim();
  if (!bundled) {
    return null;
  }

  try {
    const parsed = JSON.parse(bundled);
    const publicKey = parsed?.publicKey?.trim();
    const privateKey = parsed?.privateKey?.trim();

    if (publicKey && privateKey) {
      return {
        source: 'VAPID_KEYS (JSON)',
        publicKey,
        privateKey
      };
    }
  } catch {
    const [publicKey, privateKey] = bundled.split(':').map((value) => value?.trim());
    if (publicKey && privateKey) {
      return {
        source: 'VAPID_KEYS (public:private)',
        publicKey,
        privateKey
      };
    }
  }

  return null;
}

const vapid = resolveVapidKeys();

if (!vapid) {
  console.error('[push] Missing VAPID keys in environment.');
  console.error('[push] Use either:');
  console.error('[push] 1) VAPID_PUBLIC_KEY + VAPID_PRIVATE_KEY');
  console.error('[push] 2) VAPID_KEYS as JSON: {"publicKey":"...","privateKey":"..."}');
  console.error('[push] 3) VAPID_KEYS as public:private');
  console.error('[push] Generate keys with: node scripts/generate-vapid-keys.js');
  process.exit(1);
}

// Requested behavior: always log keys at startup.
console.log(`[push] VAPID key source: ${vapid.source}`);
console.log(`[push] VAPID_PUBLIC_KEY=${vapid.publicKey}`);
console.log(`[push] VAPID_PRIVATE_KEY=${vapid.privateKey}`);

webpush.setVapidDetails(CONTACT_EMAIL, vapid.publicKey, vapid.privateKey);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function loadSubscriptions() {
  try {
    const content = await fs.readFile(subscriptionsPath, 'utf-8');
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }

    throw error;
  }
}

async function saveSubscriptions(subscriptions) {
  await fs.writeFile(subscriptionsPath, JSON.stringify(subscriptions, null, 2));
}

function subscriptionKey(subscription) {
  return `${subscription.endpoint}|${subscription.keys?.p256dh}|${subscription.keys?.auth}`;
}

app.get('/api/config', (_req, res) => {
  res.json({
    publicVapidKey: vapid.publicKey,
    defaultIntervalMs: DEFAULT_INTERVAL_MS,
    maxSendCount: MAX_SPAM_COUNT
  });
});

app.post('/api/subscribe', async (req, res) => {
  const subscription = req.body;
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription payload' });
  }

  const subscriptions = await loadSubscriptions();
  const incomingKey = subscriptionKey(subscription);
  const exists = subscriptions.some((item) => subscriptionKey(item) === incomingKey);

  if (!exists) {
    subscriptions.push(subscription);
    await saveSubscriptions(subscriptions);
  }

  return res.status(201).json({ success: true, subscriptionCount: subscriptions.length });
});

app.post('/api/send', async (req, res) => {
  const {
    title = 'Background Notification',
    message = 'This is a reliable push message',
    count = 1,
    intervalMs = DEFAULT_INTERVAL_MS
  } = req.body || {};

  const safeCount = Math.max(1, Math.min(Number(count) || 1, MAX_SPAM_COUNT));
  const safeIntervalMs = Math.max(100, Number(intervalMs) || DEFAULT_INTERVAL_MS);

  const subscriptions = await loadSubscriptions();
  if (subscriptions.length === 0) {
    return res.status(400).json({ error: 'No subscriptions saved yet.' });
  }

  const sent = [];
  for (let i = 0; i < safeCount; i += 1) {
    const nonce = crypto.randomUUID();

    const payload = JSON.stringify({
      title,
      body: message,
      nonce,
      sentAt: new Date().toISOString(),
      index: i + 1,
      total: safeCount,

    });

    // eslint-disable-next-line no-await-in-loop
    await Promise.allSettled(
      subscriptions.map((subscription) => webpush.sendNotification(subscription, payload))
    );


    if (i < safeCount - 1) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, safeIntervalMs));
    }
  }

  return res.json({ success: true, sent, count: safeCount, intervalMs: safeIntervalMs });
});

app.listen(PORT, () => {
  console.log(`[server] Running at http://localhost:${PORT}`);
});
