(function () {
  const root = document.getElementById('admin-root');

  let me = null;
  let users = [];
  let profiles = [];
  let tab = 'users';
  let search = '';
  let profileFilter = 'all';

  const isAdmin = () => !!me && me.role === 'admin';
  const staff = (u) => !!u && (u.role === 'admin' || u.is_moderator === 1 || u.is_moderator === true);

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
    if (u.is_blocked) out.push('<span class="adm-badge bad">Заблокирован</span>');
    return out.join('');
  }

  function userRow(u) {
    const self = u.id === me.id;
    const canBlock =
      !self && u.role !== 'admin' && (isAdmin() || !u.is_moderator);
    const canToggleMod = isAdmin() && u.role !== 'admin';

    const actions = [];
    if (canBlock) {
      actions.push(
        u.is_blocked
          ? `<button class="btn btn-sm btn-ghost" data-action="block" data-id="${u.id}" data-value="0">Разблокировать</button>`
          : `<button class="btn btn-sm btn-ghost adm-danger" data-action="block" data-id="${u.id}" data-value="1">Заблокировать</button>`
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
        ${actions.length ? `<div class="adm-actions">${actions.join('')}</div>` : ''}
      </div>
    `;
  }

  function profileRow(p) {
    const hidden = p.status !== 'approved';
    const actions = [
      `<a class="btn btn-sm btn-ghost" href="/profile.html?id=${p.id}">Открыть</a>`,
      hidden
        ? `<button class="btn btn-sm btn-ghost" data-action="pstatus" data-id="${p.id}" data-value="approved">Показать в каталоге</button>`
        : `<button class="btn btn-sm btn-ghost" data-action="pstatus" data-id="${p.id}" data-value="rejected">Скрыть</button>`,
      `<button class="btn btn-sm btn-ghost adm-danger" data-action="pdelete" data-id="${p.id}">Удалить</button>`,
    ];

    return `
      <div class="adm-row">
        <div>
          <div class="adm-title">
            ${escapeHtml(p.name)}
            <span class="adm-badge ${hidden ? 'bad' : 'ok'}">${hidden ? 'Скрыта' : 'Опубликована'}</span>
          </div>
          <div class="adm-sub">
            ${escapeHtml(p.role_title || '')} · автор: ${escapeHtml(p.username)}${p.is_blocked ? ' (заблокирован)' : ''}
          </div>
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

    if (tab === 'users') {
      const rows = users.filter((u) =>
        !q || `${u.username} ${u.email || ''}`.toLowerCase().includes(q)
      );
      box.innerHTML = rows.length
        ? rows.map(userRow).join('')
        : '<div class="empty-state">Никого не найдено.</div>';
    } else {
      const rows = profiles.filter((p) => {
        if (profileFilter === 'approved' && p.status !== 'approved') return false;
        if (profileFilter === 'hidden' && p.status === 'approved') return false;
        return !q || `${p.name} ${p.username} ${p.role_title || ''}`.toLowerCase().includes(q);
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
    box.innerHTML = chip('all', 'Все') + chip('approved', 'Опубликованные') + chip('hidden', 'Скрытые');
  }

  function renderTabs() {
    const box = document.getElementById('adm-tabs');
    if (!box) return;
    const chip = (value, label) =>
      `<button class="adm-chip ${tab === value ? 'active' : ''}" data-tab="${value}">${label}</button>`;
    box.innerHTML =
      chip('users', `Аккаунты (${users.length})`) + chip('profiles', `Анкеты (${profiles.length})`);
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
    refreshView();
  }

  function refreshView() {
    renderTabs();
    renderFilters();
    renderList();
  }

  async function loadAll() {
    const [u, p] = await Promise.all([
      api('/users', { auth: true }),
      api('/mod/profiles', { auth: true }),
    ]);
    users = u.users;
    profiles = p.profiles;
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

    if (action === 'block') {
      const block = value === '1';
      const target = users.find((u) => u.id === id);
      if (block && !window.confirm(`Заблокировать аккаунт ${target ? target.username : ''}?`)) return;
      act(
        () => api(`/users/${id}/block`, { method: 'PATCH', auth: true, body: { blocked: block } }),
        block ? 'Аккаунт заблокирован' : 'Аккаунт разблокирован'
      );
    } else if (action === 'mod') {
      const on = value === '1';
      act(
        () => api(`/users/${id}/moderator`, { method: 'PATCH', auth: true, body: { moderator: on } }),
        on ? 'Модератор назначен' : 'Модератор снят'
      );
    } else if (action === 'pstatus') {
      act(
        () => api(`/mod/profiles/${id}/status`, { method: 'PATCH', auth: true, body: { status: value } }),
        value === 'approved' ? 'Анкета снова в каталоге' : 'Анкета скрыта'
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
