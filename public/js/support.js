function supDate(v) {
  return escapeHtml(String(v || '').slice(0, 16).replace('T', ' '));
}

function ticketPills(t) {
  const st = t.status === 'open' ? '<span class="sup-pill ok">Открыто</span>' : '<span class="sup-pill">Закрыто</span>';
  return st;
}

async function loadSupport() {
  const root = document.getElementById('support-root');

  if (!getToken() || !getStoredUser()) {
    root.innerHTML = `
      <div class="form-card center">
        <h2 class="mt-0">Поддержка</h2>
        <p class="text-muted">Чтобы написать в поддержку, нужно войти в аккаунт. Ответы на частые вопросы есть в <a href="/faq.html">FAQ</a>.</p>
        <div class="hero-actions" style="justify-content:center;">
          <a href="/login.html" class="btn btn-primary">Войти</a>
          <a href="/register.html" class="btn">Регистрация</a>
        </div>
      </div>`;
    return;
  }

  const id = new URLSearchParams(window.location.search).get('id');
  if (id) return showTicket(root, id);
  return showList(root);
}

async function showList(root) {
  let tickets;
  try {
    ({ tickets } = await api('/support/tickets', { auth: true }));
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Ошибка: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const rows = tickets
    .map(
      (t) => `
      <a class="sup-row" href="/support.html?id=${t.id}">
        <b>${escapeHtml(t.subject)} ${ticketPills(t)}${t.status === 'open' && !t.awaiting_staff ? '<span class="sup-pill warn">Есть ответ</span>' : ''}</b>
        <span class="text-muted" style="font-size:13px;">Сообщений: ${t.messages_count} · обновлено ${supDate(t.updated_at)}</span>
      </a>`
    )
    .join('');

  root.innerHTML = `
    <div class="section-head">
      <div><h2>Поддержка</h2><p>Напиши нам, если что-то не работает или нужна помощь. Сначала загляни в <a href="/faq.html">FAQ</a>.</p></div>
    </div>

    <div class="form-card sup-form" style="margin-bottom:24px;">
      <h3 class="mt-0">Новое обращение</h3>
      <div class="field"><label>Тема</label><input type="text" id="sup-subject" maxlength="100" placeholder="Коротко, о чём речь" /></div>
      <div class="field"><label>Сообщение <span class="hint">от 10 символов</span></label><textarea id="sup-body" rows="5" maxlength="2000" placeholder="Опиши проблему подробно"></textarea></div>
      <button class="btn btn-primary" id="sup-send">Отправить</button>
      <div id="sup-msg" class="form-msg"></div>
    </div>

    <h3>Мои обращения</h3>
    <div class="sup-list">${rows || '<div class="empty-state">Обращений пока нет.</div>'}</div>
  `;

  document.getElementById('sup-send').addEventListener('click', async () => {
    const msg = document.getElementById('sup-msg');
    msg.className = 'form-msg';
    const btn = document.getElementById('sup-send');
    btn.disabled = true;
    try {
      const { ticket } = await api('/support/tickets', {
        method: 'POST',
        auth: true,
        body: {
          subject: document.getElementById('sup-subject').value,
          body: document.getElementById('sup-body').value,
        },
      });
      window.location.href = `/support.html?id=${ticket.id}`;
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
}

async function showTicket(root, id) {
  let data;
  try {
    data = await api(`/support/tickets/${encodeURIComponent(id)}`, { auth: true });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Обращение не найдено: ${escapeHtml(err.message)} <br /><a href="/support.html">К списку</a></div>`;
    return;
  }
  const { ticket, messages } = data;
  const me = getStoredUser();
  const staffView = typeof isStaffUser === 'function' && isStaffUser(me) && ticket.user_id !== me.id;

  const thread = messages
    .map(
      (m) => `
      <div class="sup-msg ${m.is_staff ? 'staff' : ''}">
        <div class="sup-meta">${m.is_staff ? 'Поддержка' : escapeHtml(m.author_name || 'Пользователь')} · ${supDate(m.created_at)}</div>
        <div style="white-space:pre-wrap;">${escapeHtml(m.body)}</div>
      </div>`
    )
    .join('');

  root.innerHTML = `
    <p><a href="/support.html">← Все обращения</a></p>
    <div class="section-head">
      <div>
        <h2>${escapeHtml(ticket.subject)} ${ticketPills(ticket)}</h2>
        <p>${staffView ? 'Автор: <a href="/user.html?id=' + ticket.user_id + '">' + escapeHtml(ticket.username) + '</a> · ' : ''}создано ${supDate(ticket.created_at)}</p>
      </div>
    </div>
    ${thread}
    ${
      ticket.status === 'open'
        ? `<div class="sup-form" style="margin-top:16px;">
             <textarea id="sup-reply" rows="3" maxlength="2000" placeholder="${staffView ? 'Ответ от поддержки' : 'Твоё сообщение'}"></textarea>
             <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;">
               <button class="btn btn-primary" id="sup-reply-send">Отправить</button>
               <button class="btn btn-ghost" id="sup-close">Закрыть обращение</button>
             </div>
           </div>`
        : `<div style="margin-top:16px;"><button class="btn" id="sup-reopen">Открыть снова</button></div>`
    }
    <div id="sup-msg" class="form-msg"></div>
  `;

  const fail = (err) => {
    const msg = document.getElementById('sup-msg');
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  };

  const send = document.getElementById('sup-reply-send');
  if (send) {
    send.addEventListener('click', async () => {
      send.disabled = true;
      try {
        await api(`/support/tickets/${ticket.id}/messages`, {
          method: 'POST',
          auth: true,
          body: { body: document.getElementById('sup-reply').value },
        });
        showTicket(root, id);
      } catch (err) {
        fail(err);
        send.disabled = false;
      }
    });
  }
  const setStatus = (status) => async () => {
    try {
      await api(`/support/tickets/${ticket.id}/status`, { method: 'PATCH', auth: true, body: { status } });
      showTicket(root, id);
    } catch (err) {
      fail(err);
    }
  };
  const close = document.getElementById('sup-close');
  if (close) close.addEventListener('click', setStatus('closed'));
  const reopen = document.getElementById('sup-reopen');
  if (reopen) reopen.addEventListener('click', setStatus('open'));
}

document.addEventListener('DOMContentLoaded', loadSupport);
