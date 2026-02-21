const enableButton = document.getElementById('enablePush');
const sendButton = document.getElementById('send');
const status = document.getElementById('status');
const subStatus = document.getElementById('subStatus');

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

  status.textContent = JSON.stringify(data, null, 2);
}

enableButton.addEventListener('click', async () => {
  try {
    await registerAndSubscribe();
    status.textContent = 'Push enabled successfully.';
  } catch (error) {
    status.textContent = error.message;
  }
});

sendButton.addEventListener('click', async () => {
  try {
    await sendBatch();
  } catch (error) {
    status.textContent = error.message;
  }
});
