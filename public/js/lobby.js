let lastId = 0;
let me = null;
let pollTimer = null;

function fmtTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
    return d.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (e) {
    return String(iso).slice(0, 16);
  }
}

function appendMessages(list, replace) {
  const box = document.getElementById('lobby-msgs');
  if (!box) return;
  if (replace) {
    box.innerHTML = '';
    lastId = 0;
  }
  if (!list || !list.length) {
    if (!box.children.length) {
      box.innerHTML = '<div class="lobby-empty">Пока тихо. Напиши первое сообщение.</div>';
    }
    return;
  }
  const empty = box.querySelector('.lobby-empty');
  if (empty) empty.remove();

  list.forEach((m) => {
    if (m.id <= lastId) return;
    lastId = Math.max(lastId, m.id);
    const mine = me && m.user_id === me.id;
    const el = document.createElement('div');
    el.className = 'lobby-msg' + (mine ? ' me' : '');
    el.innerHTML = `
      ${mine ? '' : `<div class="lobby-msg-name"><a href="/user.html?id=${m.user_id}">${escapeHtml(m.author_name)}</a></div>`}
      <div class="lobby-msg-body">${escapeHtml(m.body)}</div>
      <div class="lobby-msg-time">${escapeHtml(fmtTime(m.created_at))}</div>
    `;
    box.appendChild(el);
  });
  box.scrollTop = box.scrollHeight;
}

async function loadLobby(initial) {
  try {
    const q = initial ? '' : `?after=${lastId}`;
    const data = await api('/chat/lobby' + q, { auth: !!getToken() });
    appendMessages(data.messages || [], !!initial);
  } catch (err) {
    if (initial) {
      document.getElementById('lobby-msgs').innerHTML =
        `<div class="lobby-empty">${escapeHtml(err.message)}</div>`;
    }
  }
}

async function sendLobby() {
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  const input = document.getElementById('lobby-input');
  const body = (input.value || '').trim();
  if (!body) return;
  const btn = document.getElementById('lobby-send');
  btn.disabled = true;
  try {
    const { message } = await api('/chat/lobby', {
      method: 'POST',
      auth: true,
      body: { body },
    });
    input.value = '';
    appendMessages([message], false);
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
    else window.alert(err.message);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  me = getStoredUser();
  const compose = document.getElementById('lobby-compose');
  if (!getToken()) {
    compose.innerHTML =
      '<p class="text-muted" style="margin:0;width:100%;text-align:center;"><a href="/login.html">Войди</a>, чтобы писать в общий чат</p>';
  } else {
    document.getElementById('lobby-send').addEventListener('click', sendLobby);
    document.getElementById('lobby-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        sendLobby();
      }
    });
  }
  loadLobby(true);
  pollTimer = setInterval(() => loadLobby(false), 3500);
});
