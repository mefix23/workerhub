const API_BASE = '/api';

function getToken() {
  return localStorage.getItem('workerhub_token');
}

function setToken(token) {
  if (token) localStorage.setItem('workerhub_token', token);
}

function clearToken() {
  localStorage.removeItem('workerhub_token');
  localStorage.removeItem('workerhub_user');
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('workerhub_user');
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function setStoredUser(user) {
  if (user) localStorage.setItem('workerhub_user', JSON.stringify(user));
}

async function api(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(API_BASE + path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch (e) {
    data = null;
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status})`;
    throw new Error(message);
  }
  return data;
}

function formatPrice(cents, currency = 'RUB') {
  const symbols = { RUB: '₽', USD: '$', EUR: '€' };
  const symbol = symbols[currency] || currency;
  const major = Math.round(cents) / 100;
  return `${major.toLocaleString('ru-RU')} ${symbol}`;
}

function initials(name) {
  if (!name) return '?';
  return name.trim().slice(0, 2).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
