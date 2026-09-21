function userStatusLabel(status) {
  const map = { pending: 'На модерации', approved: 'Опубликована', rejected: 'Отклонена' };
  return map[status] || status;
}

function warnMeter(count, max) {
  let dots = '';
  for (let i = 0; i < max; i += 1) dots += i < count ? '●' : '○';
  return `<span style="letter-spacing:3px;color:${count ? '#fca5a5' : 'var(--text-muted)'};">${dots}</span>`;
}

function warnBlock(data) {
  const max = data.max_warnings;
  const list = (data.warnings || [])
    .map(
      (w) => `
      <li style="margin-bottom:8px;">
        ${escapeHtml(w.reason)}
        <span class="text-muted" style="font-size:12.5px;">
          · ${escapeHtml(String(w.created_at).slice(0, 10))}${w.issued_by_name ? ' · выдал ' + escapeHtml(w.issued_by_name) : ''}
        </span>
      </li>`
    )
    .join('');

  const blockedText = data.user.is_blocked
    ? `<p style="color:#fca5a5;margin:8px 0 0;">Аккаунт заблокирован.</p>`
    : '';

  return `
    <div class="profile-block" style="margin-top:24px;">
      <h3>Предупреждения (WARN) ${warnMeter(data.warn_count, max)} ${data.warn_count}/${max}</h3>
      ${
        list
          ? `<ul style="padding-left:18px;">${list}</ul>`
          : '<p class="text-muted">Предупреждений нет.</p>'
      }
      ${blockedText}
      <p class="text-muted" style="font-size:12.5px;">После ${max} предупреждений аккаунт блокируется.</p>
    </div>
  `;
}

function ownProfileTile(p) {
  const off = p.status === 'approved' && !p.is_active ? '<span class="status-pill">REQ—OFF</span>' : '';
  const reason =
    p.status === 'rejected' && p.reject_reason
      ? `<span class="text-muted" style="font-size:13px;">Причина: ${escapeHtml(p.reject_reason)}</span>`
      : '';
  return `
    <div>
      ${profileCard(p)}
      <div style="margin:8px 4px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
        <span class="status-pill">${userStatusLabel(p.status)}</span>${off}
        <a class="btn btn-sm btn-ghost" href="/create.html?edit=${p.id}">Изменить</a>${reason}
      </div>
    </div>
  `;
}

async function loadUser() {
  const root = document.getElementById('user-root');
  const params = new URLSearchParams(window.location.search);
  let id = params.get('id');
  const me = getStoredUser();

  if (!id) {
    if (!me || !getToken()) {
      root.innerHTML = `
        <div class="form-card center">
          <h2 class="mt-0">Нужно войти</h2>
          <p class="text-muted">Войди в аккаунт, чтобы открыть свой профиль.</p>
          <div class="hero-actions" style="justify-content:center;">
            <a href="/login.html" class="btn btn-primary">Войти</a>
            <a href="/register.html" class="btn">Регистрация</a>
          </div>
        </div>`;
      return;
    }
    id = me.id;
  }

  try {
    const data = await api(`/users/${encodeURIComponent(id)}/public`, { auth: true });
    const u = data.user;
    document.title = `${u.username} — WORKERHUB`;

    const badges = [
      u.role === 'admin' ? '<span class="tag">Админ</span>' : '',
      u.is_moderator ? '<span class="tag">Модератор</span>' : '',
      u.is_blocked ? '<span class="tag" style="color:#fca5a5;">Заблокирован</span>' : '',
    ].join('');

    const showWarns = typeof data.warn_count === 'number';
    const tiles = data.profiles.length
      ? data.profiles.map((p) => (data.is_self ? ownProfileTile(p) : profileCard(p))).join('')
      : `<div class="empty-state">${
          data.is_self ? 'У тебя пока нет анкет.' : 'Опубликованных анкет нет.'
        }</div>`;

    root.innerHTML = `
      <div class="profile-header" style="padding-top:0;">
        <div class="avatar-lg">${initials(u.username)}</div>
        <div>
          <h1 class="profile-name">${escapeHtml(u.username)}</h1>
          <div class="tag-row">${badges}</div>
          <div class="text-muted" style="font-size:13px;margin-top:8px;">
            На сайте с ${new Date(u.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('ru-RU')}
            ${data.is_self && u.email ? ' · ' + escapeHtml(u.email) : ''}
          </div>
          ${data.is_self ? '<div style="margin-top:14px;"><a class="btn btn-primary btn-sm" href="/create.html">Создать анкету</a></div>' : ''}
        </div>
      </div>

      ${
        data.is_self
          ? `<div class="profile-block" style="margin-top:24px;"><h3>Монеты</h3><p style="margin:0;"><b style="color:#fbbf24;">🪙 ${Number(u.coins) || 0}</b> · <a href="/shop.html">Магазин</a> · <a href="/faq.html">Как получить монеты</a></p></div>`
          : ''
      }
      ${showWarns ? warnBlock({ ...data, user: u }) : ''}

      <div class="section-head" style="margin-top:32px;">
        <div><h2>${data.is_self ? 'Мои анкеты' : 'Анкеты'}</h2></div>
      </div>
      <div class="grid">${tiles}</div>
    `;
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Профиль не найден: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadUser);
