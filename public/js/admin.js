(function () {
  const root = document.getElementById('admin-root');

  let me = null;
  let users = [];
  let profiles = [];
  let queue = [];
  let reviews = [];
  let tickets = [];
  let tab = 'queue';
  let search = '';
  let profileFilter = 'all';

  const isAdmin = () => !!me && me.role === 'admin';
  const staff = (u) => !!u && (u.role === 'admin' || u.is_moderator === 1 || u.is_moderator === true);
  const MAX_WARN = 3;
  const TIERS = [
    ['low', 'Низкий'],
    ['below_avg', 'Ниже среднего'],
    ['avg', 'Средний'],
    ['above_avg', 'Выше среднего'],
    ['high', 'Высокий'],
    ['excellent', 'Отличный'],
  ];

  // Skill tier picker used in the moderation queue and the profiles list.
  function tierSelect(p) {
    const opts = ['<option value="">— тир не выбран —</option>']
      .concat(
        TIERS.map(
          ([slug, label]) => `<option value="${slug}"${p.tier === slug ? ' selected' : ''}>${label}</option>`
        )
      )
      .join('');
    return `<select data-tier="${p.id}" style="padding:8px 10px;border-radius:var(--radius-md);border:1px solid var(--border-strong);background:var(--bg-input);color:inherit;color-scheme:dark;max-width:100%;">${opts}</select>`;
  }

  function toast(message, type) {
    if (typeof window.showToast === 'function') window.showToast(message, type || 'success');
  }

  // ---------- screens without access ----------

  function renderGate(title, text, extra) {
    root.innerHTML = `
      <div class="form-card adm-gate">
        <h2 style="margin-bottom:10px;">${escapeHtml(title)}</h2>
        <p class="text-muted" style="margin-top:0;">${escapeHtml(text)}</p>
        ${extra || ''}
      </div>
    `;
  }

  function renderNoAccess() {
    renderGate(
      'Нет доступа',
      'Эта страница только для админов и модераторов. Если ты владелец сайта, введи секретный ключ администратора.',
      `
        <div id="claim-msg" class="form-msg"></div>
        <form id="claim-form">
          <div class="field">
            <label>Ключ администратора</label>
            <input type="password" name="key" autocomplete="off" required />
          </div>
          <button class="btn btn-primary btn-block" type="submit">Стать админом</button>
        </form>
      `
    );

    document.getElementById('claim-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('claim-msg');
      msg.className = 'form-msg';
      const key = new FormData(e.target).get('key');
      try {
        const { user } = await api('/users/claim-admin', {
          method: 'POST',
          auth: true,
          body: { key: String(key || '') },
        });
        setStoredUser(user);
        window.location.reload();
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err.message;
      }
    });
  }

  // ---------- staff panel ----------

  function roleBadges(u) {
    const out = [];
    if (u.role === 'admin') out.push('<span class="adm-badge admin">Админ</span>');
    if (u.is_moderator) out.push('<span class="adm-badge mod">Модератор</span>');
    if (u.warn_count) out.push(`<span class="adm-badge bad">WARN ${u.warn_count}/${MAX_WARN}</span>`);
    if (u.is_blocked) out.push('<span class="adm-badge bad">Заблокирован</span>');
    return out.join('');
  }

  function userRow(u) {
    const self = u.id === me.id;
    const canPunish = !self && u.role !== 'admin' && (isAdmin() || !u.is_moderator);
    const canToggleMod = isAdmin() && u.role !== 'admin';

    const actions = [`<a class="btn btn-sm btn-ghost" href="/user.html?id=${u.id}">Профиль</a>`];
    if (canPunish) {
      actions.push(
        `<button class="btn btn-sm btn-ghost adm-danger" data-action="warn" data-id="${u.id}">Выдать WARN</button>`
      );
      actions.push(
        u.is_blocked
          ? `<button class="btn btn-sm btn-ghost" data-action="block" data-id="${u.id}" data-value="0">Разблокировать</button>`
          : `<button class="btn btn-sm btn-ghost adm-danger" data-action="block" data-id="${u.id}" data-value="1">Заблокировать</button>`
      );
    }
    if (isAdmin()) {
      actions.push(
        `<button class="btn btn-sm btn-ghost" data-action="coins" data-id="${u.id}">Выдать монеты</button>`
      );
    }
    if (isAdmin() && u.warn_count > 0 && u.role !== 'admin') {
      actions.push(
        `<button class="btn btn-sm btn-ghost" data-action="unwarn" data-id="${u.id}">Снять последний WARN</button>`
      );
    }
    if (canToggleMod) {
      actions.push(
        u.is_moderator
          ? `<button class="btn btn-sm btn-ghost" data-action="mod" data-id="${u.id}" data-value="0">Снять модератора</button>`
          : `<button class="btn btn-sm btn-ghost" data-action="mod" data-id="${u.id}" data-value="1">Сделать модератором</button>`
      );
    }

    const date = String(u.created_at || '').slice(0, 10);
    const sub = [
      u.email ? escapeHtml(u.email) : null,
      `анкет: ${u.profiles_count}`,
      isAdmin() && typeof u.coins === 'number' ? `🪙 ${u.coins}` : null,
      date ? `с ${escapeHtml(date)}` : null,
    ]
      .filter(Boolean)
      .join(' · ');

    return `
      <div class="adm-row">
        <div>
          <div class="adm-title">${escapeHtml(u.username)}${self ? ' <span class="text-muted">(это ты)</span>' : ''} ${roleBadges(u)}</div>
          <div class="adm-sub">${sub}</div>
        </div>
        <div class="adm-actions">${actions.join('')}</div>
      </div>
    `;
  }

  function queueRow(p) {
    const avatar = p.avatar_url
      ? `<img src="${escapeHtml(p.avatar_url)}" alt="" style="width:56px;height:56px;border-radius:50%;object-fit:cover;flex:none;" />`
      : `<div class="avatar" style="width:56px;height:56px;flex:none;">${escapeHtml(initials(p.name))}</div>`;
    const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const mediaHtml = (p.media || [])
      .map((m) =>
        m.type === 'image'
          ? `<img src="${escapeHtml(m.url)}" alt="" style="width:88px;height:88px;object-fit:cover;border-radius:8px;" />`
          : `<a class="btn btn-sm btn-ghost" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer">▶ видео</a>`
      )
      .join('');

    return `
      <div class="adm-row">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          ${avatar}
          <div style="min-width:0;">
            <div class="adm-title">${escapeHtml(p.name)} <span class="adm-badge">${escapeHtml(p.role_title || '')}</span></div>
            <div class="adm-sub">Название: ${escapeHtml(p.title || '—')} · Цена: ${escapeHtml(formatPrice(p.price_cents, p.currency))}</div>
            <div class="adm-sub">Контакт: ${escapeHtml(p.contact)}</div>
            <div class="adm-sub">
              Автор: <a href="/user.html?id=${p.user_id}">${escapeHtml(p.username)}</a>
              ${p.warn_count ? ` <span class="adm-badge bad">WARN ${p.warn_count}/${MAX_WARN}</span>` : ''}
              ${p.is_blocked ? ' <span class="adm-badge bad">Заблокирован</span>' : ''}
            </div>
          </div>
        </div>
        ${p.description ? `<div class="adm-desc" style="white-space:pre-wrap;"><b>Описание:</b> ${escapeHtml(p.description)}</div>` : ''}
        <div class="adm-desc" style="white-space:pre-wrap;"><b>Услуги:</b> ${escapeHtml(p.services_text || '—')}</div>
        ${mediaHtml ? `<div style="display:flex;gap:8px;flex-wrap:wrap;">${mediaHtml}</div>` : ''}
        ${tags ? `<div class="tag-row">${tags}</div>` : ''}
        <div class="adm-actions" style="align-items:center;">
          ${tierSelect(p)}
          <button class="btn btn-sm btn-primary" data-action="pstatus" data-id="${p.id}" data-value="approved">Выложить</button>
          <button class="btn btn-sm btn-ghost adm-danger" data-action="pstatus" data-id="${p.id}" data-value="rejected">Отклонить</button>
          <a class="btn btn-sm btn-ghost" href="/profile.html?id=${p.id}">Открыть</a>
        </div>
      </div>
    `;
  }

  function reviewRow(r) {
    return `
      <div class="adm-row">
        <div>
          <div class="adm-title">
            <span style="color:#fbbf24;letter-spacing:1px;">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</span>
            <a href="/profile.html?id=${r.profile_id}">${escapeHtml(r.profile_name)}</a>
          </div>
          <div class="adm-sub">Автор отзыва: <a href="/user.html?id=${r.author_id}">${escapeHtml(r.author_name)}</a> · ${escapeHtml(String(r.created_at).slice(0, 16))}</div>
          <div class="adm-desc" style="white-space:pre-wrap;">${escapeHtml(r.text)}</div>
        </div>
        <div class="adm-actions">
          <button class="btn btn-sm btn-primary" data-action="rstatus" data-id="${r.id}" data-value="approved">Выложить</button>
          <button class="btn btn-sm btn-ghost adm-danger" data-action="rstatus" data-id="${r.id}" data-value="rejected">Отклонить</button>
        </div>
      </div>
    `;
  }

  function ticketRow(t) {
    const badges = [
      t.status === 'open' ? '<span class="adm-badge ok">Открыто</span>' : '<span class="adm-badge">Закрыто</span>',
      t.awaiting_staff ? '<span class="adm-badge bad">Ждёт ответа</span>' : '',
    ].join(' ');
    return `
      <div class="adm-row">
        <div>
          <div class="adm-title">${escapeHtml(t.subject)} ${badges}</div>
          <div class="adm-sub">от <a href="/user.html?id=${t.user_id}">${escapeHtml(t.username)}</a> · сообщений: ${t.messages_count} · ${escapeHtml(String(t.updated_at).slice(0, 16))}</div>
        </div>
        <div class="adm-actions"><a class="btn btn-sm btn-primary" href="/support.html?id=${t.id}">Открыть и ответить</a></div>
      </div>
    `;
  }

  function profileStatus(p) {
    if (p.status === 'pending') return ['На модерации', ''];
    if (p.status === 'rejected') return ['Отклонена', 'bad'];
    return [p.is_active ? 'Опубликована' : 'Опубликована · REQ—OFF', 'ok'];
  }

  function profileRow(p) {
    const [label, cls] = profileStatus(p);
    const actions = [`<a class="btn btn-sm btn-ghost" href="/profile.html?id=${p.id}">Открыть</a>`];
    if (p.status !== 'approved') {
      actions.push(
        `<button class="btn btn-sm btn-ghost" data-action="pstatus" data-id="${p.id}" data-value="approved">Выложить</button>`
      );
    }
    if (p.status !== 'rejected') {
      actions.push(
        `<button class="btn btn-sm btn-ghost" data-action="pstatus" data-id="${p.id}" data-value="rejected">${p.status === 'pending' ? 'Отклонить' : 'Скрыть'}</button>`
      );
    }
    actions.push(
      `<button class="btn btn-sm btn-ghost adm-danger" data-action="pdelete" data-id="${p.id}">Удалить</button>`
    );
    actions.push(tierSelect(p));

    return `
      <div class="adm-row">
        <div>
          <div class="adm-title">
            ${escapeHtml(p.name)}
            <span class="adm-badge ${cls}">${label}</span>
          </div>
          <div class="adm-sub">
            ${p.title ? escapeHtml(p.title) + ' · ' : ''}${escapeHtml(p.role_title || '')} · автор: ${escapeHtml(p.username)}${p.is_blocked ? ' (заблокирован)' : ''}
          </div>
          ${p.reject_reason ? `<div class="adm-sub">Причина отказа: ${escapeHtml(p.reject_reason)}</div>` : ''}
          <div class="adm-desc">${escapeHtml(p.description || '')}</div>
        </div>
        <div class="adm-actions">${actions.join('')}</div>
      </div>
    `;
  }

  function renderList() {
    const box = document.getElementById('adm-list');
    if (!box) return;
    const q = search.trim().toLowerCase();

    if (tab === 'queue') {
      const rows = queue.filter(
        (p) => !q || `${p.name} ${p.title || ''} ${p.username}`.toLowerCase().includes(q)
      );
      box.innerHTML = rows.length
        ? rows.map(queueRow).join('')
        : '<div class="empty-state">Новых анкет на проверке нет 🎉</div>';
    } else if (tab === 'reviews') {
      const rows = reviews.filter(
        (r) => !q || `${r.profile_name} ${r.author_name} ${r.text}`.toLowerCase().includes(q)
      );
      box.innerHTML = rows.length
        ? rows.map(reviewRow).join('')
        : '<div class="empty-state">Отзывов на проверке нет 🎉</div>';
    } else if (tab === 'support') {
      const rows = tickets.filter((t) => !q || `${t.subject} ${t.username}`.toLowerCase().includes(q));
      box.innerHTML = rows.length
        ? rows.map(ticketRow).join('')
        : '<div class="empty-state">Обращений нет.</div>';
    } else if (tab === 'users') {
      const rows = users.filter((u) => !q || `${u.username} ${u.email || ''}`.toLowerCase().includes(q));
      box.innerHTML = rows.length
        ? rows.map(userRow).join('')
        : '<div class="empty-state">Никого не найдено.</div>';
    } else {
      const rows = profiles.filter((p) => {
        if (profileFilter === 'approved' && p.status !== 'approved') return false;
        if (profileFilter === 'hidden' && p.status === 'approved') return false;
        return !q || `${p.name} ${p.title || ''} ${p.username} ${p.role_title || ''}`.toLowerCase().includes(q);
      });
      box.innerHTML = rows.length
        ? rows.map(profileRow).join('')
        : '<div class="empty-state">Анкет не найдено.</div>';
    }
  }

  function renderFilters() {
    const box = document.getElementById('adm-filters');
    if (!box) return;
    if (tab !== 'profiles') {
      box.innerHTML = '';
      return;
    }
    const chip = (value, label) =>
      `<button class="adm-chip ${profileFilter === value ? 'active' : ''}" data-filter="${value}">${label}</button>`;
    box.innerHTML = chip('all', 'Все') + chip('approved', 'Опубликованные') + chip('hidden', 'Не в каталоге');
  }

  function renderTabs() {
    const box = document.getElementById('adm-tabs');
    if (!box) return;
    const chip = (value, label) =>
      `<button class="adm-chip ${tab === value ? 'active' : ''}" data-tab="${value}">${label}</button>`;
    box.innerHTML =
      chip('queue', `На модерации (${queue.length})`) +
      chip('reviews', `Отзывы (${reviews.length})`) +
      chip('support', `Поддержка (${tickets.filter((t) => t.awaiting_staff).length})`) +
      chip('users', `Аккаунты (${users.length})`) +
      chip('profiles', `Анкеты (${profiles.length})`);
  }

  function renderShell() {
    const roleText = isAdmin() ? 'Администратор' : 'Модератор';
    root.innerHTML = `
      <div class="section-head">
        <div>
          <h2>Панель управления</h2>
          <p>Ты вошёл как: ${roleText}</p>
        </div>
      </div>
      <div class="adm-tabs" id="adm-tabs"></div>
      <div class="adm-search"><input type="text" id="adm-search" placeholder="Поиск…" /></div>
      <div class="adm-filters" id="adm-filters"></div>
      <div class="adm-list" id="adm-list"></div>
    `;

    document.getElementById('adm-search').addEventListener('input', (e) => {
      search = e.target.value;
      renderList();
    });

    root.addEventListener('click', onClick);
    root.addEventListener('change', onChange);
    refreshView();
  }

  function refreshView() {
    renderTabs();
    renderFilters();
    renderList();
  }

  async function loadAll() {
    const [u, p, qu, rv, tk] = await Promise.all([
      api('/users', { auth: true }),
      api('/mod/profiles', { auth: true }),
      api('/mod/queue', { auth: true }),
      api('/mod/reviews', { auth: true }),
      api('/support/admin/tickets?status=open', { auth: true }),
    ]);
    users = u.users;
    profiles = p.profiles;
    queue = qu.profiles;
    reviews = rv.reviews;
    tickets = tk.tickets;
  }

  async function act(fn, okMessage) {
    try {
      await fn();
      await loadAll();
      refreshView();
      toast(okMessage);
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  function onChange(e) {
    const sel = e.target.closest('select[data-tier]');
    if (!sel) return;
    const id = parseInt(sel.getAttribute('data-tier'), 10);
    const tier = sel.value || null;
    act(
      () => api(`/mod/profiles/${id}/tier`, { method: 'PATCH', auth: true, body: { tier } }),
      tier ? 'Тир сохранён' : 'Тир снят'
    );
  }

  function onClick(e) {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      tab = tabBtn.getAttribute('data-tab');
      refreshView();
      return;
    }
    const filterBtn = e.target.closest('[data-filter]');
    if (filterBtn) {
      profileFilter = filterBtn.getAttribute('data-filter');
      refreshView();
      return;
    }

    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.getAttribute('data-action');
    const id = parseInt(btn.getAttribute('data-id'), 10);
    const value = btn.getAttribute('data-value');
    const targetUser = users.find((u) => u.id === id);

    if (action === 'block') {
      const block = value === '1';
      if (block && !window.confirm(`Заблокировать аккаунт ${targetUser ? targetUser.username : ''}?`)) return;
      act(
        () => api(`/users/${id}/block`, { method: 'PATCH', auth: true, body: { blocked: block } }),
        block ? 'Аккаунт заблокирован' : 'Аккаунт разблокирован'
      );
    } else if (action === 'warn') {
      const reason = window.prompt(
        `Причина предупреждения для ${targetUser ? targetUser.username : 'аккаунта'} (её увидит пользователь):`
      );
      if (reason === null) return;
      act(
        () => api(`/users/${id}/warn`, { method: 'POST', auth: true, body: { reason } }),
        'Предупреждение выдано'
      );
    } else if (action === 'unwarn') {
      if (!window.confirm('Снять последнее предупреждение?')) return;
      act(
        () => api(`/users/${id}/warnings/last`, { method: 'DELETE', auth: true }),
        'Предупреждение снято'
      );
    } else if (action === 'coins') {
      const raw = window.prompt(
        `Сколько монет выдать ${targetUser ? targetUser.username : ''}? (целое число от 1 до 10000)`
      );
      if (raw === null) return;
      act(
        () => api(`/users/${id}/coins`, { method: 'POST', auth: true, body: { amount: Number(raw) } }),
        'Монеты выданы'
      );
    } else if (action === 'rstatus') {
      let reason = '';
      if (value === 'rejected') {
        const r = window.prompt('Причина отказа (её увидит автор отзыва). Можно оставить пустым:');
        if (r === null) return;
        reason = r;
      }
      act(
        () => api(`/mod/reviews/${id}/status`, { method: 'PATCH', auth: true, body: { status: value, reason } }),
        value === 'approved' ? 'Отзыв выложен' : 'Отзыв отклонён'
      );
    } else if (action === 'mod') {
      const on = value === '1';
      act(
        () => api(`/users/${id}/moderator`, { method: 'PATCH', auth: true, body: { moderator: on } }),
        on ? 'Модератор назначен' : 'Модератор снят'
      );
    } else if (action === 'pstatus') {
      let reason = '';
      if (value === 'rejected') {
        const r = window.prompt('Причина отказа (её увидит автор). Можно оставить пустым:');
        if (r === null) return;
        reason = r;
      }
      act(
        () => api(`/mod/profiles/${id}/status`, { method: 'PATCH', auth: true, body: { status: value, reason } }),
        value === 'approved' ? 'Анкета выложена в каталог' : 'Анкета отклонена'
      );
    } else if (action === 'pdelete') {
      if (!window.confirm('Удалить анкету навсегда? Это действие нельзя отменить.')) return;
      act(() => api(`/mod/profiles/${id}`, { method: 'DELETE', auth: true }), 'Анкета удалена');
    }
  }

  // ---------- start ----------

  async function init() {
    if (!getToken()) {
      renderGate(
        'Нужно войти',
        'Войди в аккаунт, чтобы открыть панель.',
        '<a class="btn btn-primary btn-block" href="/login.html">Войти</a>'
      );
      return;
    }

    try {
      const { user } = await api('/auth/me', { auth: true });
      me = user;
      setStoredUser(user);
    } catch (err) {
      clearToken();
      renderGate(
        'Сессия устарела',
        'Войди в аккаунт заново.',
        '<a class="btn btn-primary btn-block" href="/login.html">Войти</a>'
      );
      return;
    }

    if (!staff(me)) {
      renderNoAccess();
      return;
    }

    try {
      await loadAll();
    } catch (err) {
      renderGate('Ошибка', err.message);
      return;
    }
    renderShell();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
