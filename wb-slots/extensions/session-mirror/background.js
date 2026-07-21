const REQUIRED_COOKIES = [
  'WBToken',
  'WBTokenSig',
  'x-supplier-token',
  'x-supplier-id',
  '__wblid',
  'wbx_session_id'
];

const DEFAULT_CONFIG = {
  apiBaseUrl: 'http://localhost:3000',
  autoSync: true,
  lastStatus: 'UNPAIRED',
  lastSync: null,
  lastError: null
};

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({ sessionMirrorConfig: DEFAULT_CONFIG });
  chrome.alarms.create('session-mirror-heartbeat', { periodInMinutes: 1 });
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'session-mirror-heartbeat') {
    sendHeartbeat();
  }
});

chrome.cookies.onChanged.addListener((changeInfo) => {
  if (!changeInfo.cookie || !REQUIRED_COOKIES.includes(changeInfo.cookie.name)) {
    return;
  }

  const cause = changeInfo.cause || 'unknown';
  if (changeInfo.removed && cause === 'expired') {
    notifyUser('Сессия WB истекла', 'Пожалуйста, войдите на seller.wildberries.ru заново.');
    postEvent('USER_REAUTH_REQUIRED', { reason: 'cookie_expired' });
  } else {
    debounceSync('cookie_change');
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message?.type) {
    case 'SYNC_COOKIES':
      syncCookies('manual')
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case 'GET_STATUS':
      fetchStatus()
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    case 'SET_API_BASE':
      updateConfig({ apiBaseUrl: message.value })
        .then((config) => sendResponse({ success: true, data: config }))
        .catch((error) => sendResponse({ success: false, error: error.message }));
      return true;
    default:
      break;
  }
  return false;
});

let syncTimeout;
function debounceSync(trigger) {
  if (syncTimeout) {
    clearTimeout(syncTimeout);
  }
  syncTimeout = setTimeout(() => syncCookies(trigger), 2000);
}

async function syncCookies(trigger = 'auto') {
  const tokens = await captureCookies();
  if (Object.keys(tokens).length === 0) {
    throw new Error('Нет необходимых cookies для синхронизации');
  }

  const response = await apiFetch('/api/session-mirror/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      tokens,
      timestamp: new Date().toISOString(),
      trigger
    })
  });

  await updateConfig({
    lastStatus: 'AUTHORIZED',
    lastSync: new Date().toISOString(),
    lastError: null
  });

  return response.data;
}

async function sendHeartbeat() {
  const snapshot = await fetchStatus().catch(() => null);
  if (!snapshot || snapshot.status !== 'AUTHORIZED') {
    return;
  }

  await postEvent('HEARTBEAT', { timestamp: new Date().toISOString() });
}

async function postEvent(type, payload) {
  await apiFetch('/api/session-mirror/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({
      type,
      ...payload
    })
  });
}

async function fetchStatus() {
  const response = await apiFetch('/api/session-mirror/status', {
    method: 'GET',
    credentials: 'include'
  });
  return response.data;
}

async function captureCookies() {
  const cookies = await chrome.cookies.getAll({ domain: '.wildberries.ru' });
  return cookies.reduce((acc, cookie) => {
    if (REQUIRED_COOKIES.includes(cookie.name)) {
      acc[cookie.name] = cookie.value;
    }
    return acc;
  }, {});
}

async function apiFetch(path, options) {
  const config = await getConfig();
  if (!config.apiBaseUrl) {
    throw new Error('Не указан адрес API. Настройте расширение.');
  }

  const url = new URL(path, config.apiBaseUrl).toString();
  const response = await fetch(url, options);
  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    await updateConfig({ lastError: errorBody?.error || response.statusText });
    throw new Error(errorBody?.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

async function getConfig() {
  const stored = await chrome.storage.local.get('sessionMirrorConfig');
  return {
    ...DEFAULT_CONFIG,
    ...(stored.sessionMirrorConfig || {})
  };
}

async function updateConfig(partial) {
  const current = await getConfig();
  const next = { ...current, ...partial };
  await chrome.storage.local.set({ sessionMirrorConfig: next });
  return next;
}

function notifyUser(title, message) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'icons/icon128.png',
    title,
    message
  }, () => void 0);
}

