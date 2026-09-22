let activeConvId = null;
let lastMsgId = 0;
let pollTimer = null;
let me = null;

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

function renderShell() {
  const root = document.getElementById('chat-root');
  root.innerHTML = `
    <aside class="chat-list">
      <div class="chat-list-head">Диалоги</div>
      <div class="chat-list-body" id="conv-list"></div>
    </aside>
    <section class="chat-pane">
      <div class="chat-pane-head" id="pane-head">Выбери диалог</div>
      <div class="chat-msgs" id="msg-list"></div>
      <div class="chat-compose" id="compose" style="display:none;">
        <textarea id="msg-input" rows="1" maxlength="2000" placeholder="Напиши сообщение…"></textarea>
        <button class="btn btn-primary" id="msg-send">Отправить</button>
      </div>
    </section>
  `;

  document.getElementById('msg-send').addEventListener('click', sendMessage);
  document.getElementById('msg-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
}

async function loadConversations(selectId) {
  const list = document.getElementById('conv-list');
  if (!list) return;

  let data;
  try {
    data = await api('/chat', { auth: true });
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${escapeHtml(err.message)}</div>`;
    return;
  }

  if (!data.conversations.length) {
    list.innerHTML = `<div class="chat-empty">Пока нет диалогов.<br>Открой анкету и нажми «Написать в чат».</div>`;
  } else {
    list.innerHTML = data.conversations
      .map(
        (c) => `
      <div class="chat-row${Number(c.id) === Number(activeConvId) ? ' active' : ''}" data-id="${c.id}">
        <div class="chat-row-name">
          <span>${escapeHtml(c.peer_name)}</span>
          ${c.unread ? `<span class="chat-badge">${c.unread}</span>` : ''}
        </div>
        <div class="chat-row-preview">${escapeHtml(c.last_body || 'Нет сообщений')}</div>
      </div>`
      )
      .join('');

    list.querySelectorAll('.chat-row').forEach((row) => {
      row.addEventListener('click', () => openConversation(Number(row.getAttribute('data-id'))));
    });
  }

  if (selectId) {
    openConversation(Number(selectId));
  }
}

async function openConversation(id) {
  activeConvId = id;
  lastMsgId = 0;
  const list = document.getElementById('msg-list');
  const head = document.getElementById('pane-head');
  const compose = document.getElementById('compose');

  document.querySelectorAll('.chat-row').forEach((r) => {
    r.classList.toggle('active', Number(r.getAttribute('data-id')) === id);
  });

  list.innerHTML = `<div class="chat-empty">Загрузка…</div>`;
  try {
    const data = await api(`/chat/${id}`, { auth: true });
    head.textContent = data.conversation.peer_name;
    compose.style.display = 'flex';
    list.innerHTML = '';
    appendMessages(data.messages);
    list.scrollTop = list.scrollHeight;
    // refresh unread badges
    loadConversations();
  } catch (err) {
    list.innerHTML = `<div class="chat-empty">${escapeHtml(err.message)}</div>`;
    compose.style.display = 'none';
  }
}

function appendMessages(messages) {
  const list = document.getElementById('msg-list');
  if (!list || !messages || !messages.length) {
    if (list && !list.children.length) {
      list.innerHTML = `<div class="chat-empty">Напиши первое сообщение</div>`;
    }
    return;
  }
  const empty = list.querySelector('.chat-empty');
  if (empty) empty.remove();

  messages.forEach((m) => {
    if (m.id <= lastMsgId) return;
    lastMsgId = Math.max(lastMsgId, m.id);
    const mine = me && m.sender_id === me.id;
    const el = document.createElement('div');
    el.className = `chat-bubble ${mine ? 'me' : 'them'}`;
    el.innerHTML = `${escapeHtml(m.body)}<div class="chat-meta">${escapeHtml(fmtTime(m.created_at))}</div>`;
    list.appendChild(el);
  });
}

async function sendMessage() {
  if (!activeConvId) return;
  const input = document.getElementById('msg-input');
  const body = (input.value || '').trim();
  if (!body) return;
  const btn = document.getElementById('msg-send');
  btn.disabled = true;
  try {
    const { message } = await api(`/chat/${activeConvId}/messages`, {
      method: 'POST',
      auth: true,
      body: { body },
    });
    input.value = '';
    appendMessages([message]);
    const list = document.getElementById('msg-list');
    list.scrollTop = list.scrollHeight;
    loadConversations();
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
    else window.alert(err.message);
  } finally {
    btn.disabled = false;
    input.focus();
  }
}

async function pollNew() {
  if (!activeConvId || !getToken()) return;
  try {
    const data = await api(`/chat/${activeConvId}?after=${lastMsgId}`, { auth: true });
    if (data.messages && data.messages.length) {
      appendMessages(data.messages);
      const list = document.getElementById('msg-list');
      list.scrollTop = list.scrollHeight;
      loadConversations();
    }
  } catch (err) {
    /* ignore transient poll errors */
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  me = getStoredUser();
  if (!me || !getToken()) {
    document.getElementById('chat-root').innerHTML =
      `<div class="empty-state" style="grid-column:1/-1;">Чтобы писать сообщения, <a href="/login.html">войди</a>.</div>`;
    return;
  }

  renderShell();
  const params = new URLSearchParams(window.location.search);
  const openId = params.get('id');
  await loadConversations(openId || null);

  pollTimer = setInterval(pollNew, 4000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') pollNew();
  });
});
