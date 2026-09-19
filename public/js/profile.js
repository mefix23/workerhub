function statusLabel(status) {
  const map = { pending: 'На модерации', approved: 'Опубликовано', rejected: 'Отклонено' };
  return map[status] || status;
}

async function loadProfile() {
  const root = document.getElementById('profile-root');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    root.innerHTML = `<div class="empty-state">Анкета не найдена.</div>`;
    return;
  }

  try {
    const { profile: p } = await api(`/profiles/${id}`, { auth: true });
    document.title = `${p.name} — WORKERHUB`;

    const avatarContent = p.avatar_url
      ? `<img src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(p.name)}" />`
      : initials(p.name);

    const services = (p.services || [])
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join('');
    const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const roleTags = roleBadges(p);
    const portfolio = (p.portfolio || [])
      .map((link) => `<li><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a></li>`)
      .join('');

    const user = getStoredUser();
    const isOwner = user && user.id === p.user_id;

    root.innerHTML = `
      <div class="profile-header container">
        <div class="avatar-lg">${avatarContent}</div>
        <div>
          <h1 class="profile-name">${escapeHtml(p.name)}</h1>
          <div class="tag-row">${roleTags}</div>
          ${isOwner ? `<span class="status-pill" style="margin-top:8px;display:inline-block;">${statusLabel(p.status)}</span>` : ''}
        </div>
      </div>

      <div class="profile-body container">
        <div>
          <div class="profile-block">
            <h3>Описание</h3>
            <p>${escapeHtml(p.description)}</p>
          </div>
          ${
            services
              ? `<div class="profile-block"><h3>Услуги</h3><ul>${services}</ul></div>`
              : ''
          }
          ${
            portfolio
              ? `<div class="profile-block"><h3>Портфолио</h3><ul>${portfolio}</ul></div>`
              : ''
          }
          ${tags ? `<div class="profile-block"><h3>Теги</h3><div class="tag-row">${tags}</div></div>` : ''}
          <div class="profile-block">
            <h3>Создано</h3>
            <p class="text-muted">${new Date(p.created_at).toLocaleDateString('ru-RU')}</p>
          </div>
        </div>

        <div>
          <div class="sidebar-card">
            <div class="sidebar-price">${formatPrice(p.price_cents, p.currency)}</div>
            <p class="text-muted" style="margin-top:0;">Контакт: ${escapeHtml(p.contact)}</p>
            <div id="order-area"></div>
          </div>
        </div>
      </div>
    `;

    renderOrderArea(p, user, isOwner);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Не удалось загрузить анкету: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOrderArea(profile, user, isOwner) {
  const area = document.getElementById('order-area');
  if (!area) return;

  if (isOwner) {
    area.innerHTML = `<p class="text-muted" style="font-size:13px;">Это твоя анкета.</p>`;
    return;
  }

  if (!user) {
    area.innerHTML = `<a class="btn btn-primary btn-block" style="margin-top:16px;" href="/login.html">Войти, чтобы заказать</a>`;
    return;
  }

  area.innerHTML = `
    <button class="btn btn-primary btn-block" id="order-btn" style="margin-top:16px;">Заказать</button>
    <div id="order-msg" class="form-msg"></div>
  `;

  document.getElementById('order-btn').addEventListener('click', async () => {
    const desc = window.prompt('Опиши, что нужно сделать:');
    if (!desc || !desc.trim()) return;

    const msg = document.getElementById('order-msg');
    try {
      const { order } = await api('/orders', {
        method: 'POST',
        auth: true,
        body: { profileId: profile.id, serviceDescription: desc.trim() },
      });
      msg.className = 'form-msg success';
      msg.textContent = `Заказ #${order.id} создан со статусом "created". Демо-оплату можно провести из своего кабинета заказов через API.`;
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
    }
  });
}

document.addEventListener('DOMContentLoaded', loadProfile);
