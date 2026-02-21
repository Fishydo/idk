const enableButton = document.getElementById('enablePush');
const sendButton = document.getElementById('send');
const status = document.getElementById('status');
const subStatus = document.getElementById('subStatus');

const adminButton = document.getElementById('adminMode');
const spamCommandInput = document.getElementById('spamCommand');
const runSpamCommandButton = document.getElementById('runSpamCommand');
let isAdminMode = false;

function setStatus(message) {
  status.textContent = message;
}

function parseSpamCommand(rawCommand) {
  const command = String(rawCommand || '').trim();
  const match = command.match(/^\/spam\s+time:(\d+)\s+title:(.+?)\s+message:(.+)$/i);
  if (!match) {
    throw new Error('Invalid command. Use: /spam time:{number} title:{set} message:{set}');
  }

  const intervalMs = Number(match[1]);
  const title = match[2].trim();
  const message = match[3].trim();

  if (!Number.isFinite(intervalMs) || intervalMs <= 0) {
    throw new Error('Invalid time value. time must be a number greater than 0.');
  }

  if (!title || !message) {
    throw new Error('Both title and message are required.');
  }

  return { intervalMs, title, message };
}

async function runSpamCommand() {
  if (!isAdminMode) {
    throw new Error('Admin mode is required to use /spam.');
  }

  const { intervalMs, title, message } = parseSpamCommand(spamCommandInput.value);
  const response = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message, count: 5, intervalMs })
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Spam command failed');
  }

  setStatus(JSON.stringify({ command: '/spam', ...data }, null, 2));
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

async function getConfig() {
  const response = await fetch('/api/config');
  if (!response.ok) throw new Error('Failed to load config');
  return response.json();
}

async function registerAndSubscribe() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push messaging is not supported in this browser.');
  }

  const config = await getConfig();
  const registration = await navigator.serviceWorker.register('/sw.js');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    throw new Error('Notification permission denied.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicVapidKey)
    });
  }

  const response = await fetch('/api/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subscription)
  });

  if (!response.ok) {
    throw new Error('Failed to save subscription');
  }

  const result = await response.json();
  subStatus.textContent = `Subscribed successfully. Total subscriptions: ${result.subscriptionCount}`;
}

async function sendBatch() {
  const payload = {
    title: document.getElementById('title').value,
    message: document.getElementById('message').value,
    count: Number(document.getElementById('count').value),
    intervalMs: Number(document.getElementById('intervalMs').value)
  };

  const response = await fetch('/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Send failed');
  }

  setStatus(JSON.stringify(data, null, 2));
}

enableButton.addEventListener('click', async () => {
  try {
    await registerAndSubscribe();
    setStatus('Push enabled successfully.');
  } catch (error) {
    setStatus(error.message);
  }
});

sendButton.addEventListener('click', async () => {
  try {
    await sendBatch();
  } catch (error) {
    setStatus(error.message);
  }
});


adminButton.addEventListener('click', () => {
  isAdminMode = !isAdminMode;
  adminButton.textContent = isAdminMode ? 'Disable admin mode' : 'Enable admin mode';
  setStatus(isAdminMode ? 'Admin mode enabled.' : 'Admin mode disabled.');
});

runSpamCommandButton.addEventListener('click', async () => {
  try {
    await runSpamCommand();
  } catch (error) {
    setStatus(error.message);
  }
});
