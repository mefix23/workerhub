function statusLabel(status) {
  const map = { pending: 'На модерации', approved: 'Опубликовано', rejected: 'Отклонено' };
  return map[status] || status;
}

function noticeBox(html) {
  return `<div style="border:1px solid var(--border-strong);border-radius:var(--radius-md);padding:12px 14px;margin:14px 0 0;color:var(--text-secondary);font-size:14px;">${html}</div>`;
}

// What the owner needs to know about the state of his profile.
function ownerNotice(p) {
  if (p.status === 'pending') {
    return noticeBox('⏳ Анкета на модерации. В каталоге она появится после проверки.');
  }
  if (p.status === 'rejected') {
    const reason = p.reject_reason ? ` Причина: ${escapeHtml(p.reject_reason)}` : '';
    return noticeBox(`❌ Модератор отклонил анкету.${reason}`);
  }
  if (!p.is_active) {
    return noticeBox('Анкета отключена (REQ—OFF) и не видна в каталоге. Нажми «REQ—ON», чтобы включить.');
  }
  return '';
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

    // Old profiles may still carry a plain list of services.
    const services = (p.services || [])
      .map((s) => `<li>${escapeHtml(s)}</li>`)
      .join('');
    const tags = (p.tags || []).map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('');
    const roleTags = roleBadges(p);
    const portfolio = (p.portfolio || [])
      .map((link) => `<li><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a></li>`)
      .join('');

    const user = getStoredUser();
    const isOwner = !!user && user.id === p.user_id;
    const seesStatus = isOwner || (typeof isStaffUser === 'function' && isStaffUser(user));

    const author = p.owner
      ? `<div class="text-muted" style="font-size:13px;margin-top:8px;">Автор: <a href="/user.html?id=${p.owner.id}" style="font-weight:600;">${escapeHtml(p.owner.username)}</a></div>`
      : '';

    const media = (p.media || [])
      .map((m) =>
        m.type === 'image'
          ? `<div class="pf-item"><img src="${escapeHtml(m.url)}" alt="Работа" data-zoom="1" /></div>`
          : `<div class="pf-item"><a class="pf-video" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer"><span>▶ Смотреть видео</span><small>${escapeHtml(m.url)}</small></a></div>`
      )
      .join('');

    root.innerHTML = `
      <div class="profile-header container">
        <div class="avatar-lg">${avatarContent}</div>
        <div>
          <h1 class="profile-name">${escapeHtml(p.name)}</h1>
          ${p.title ? `<div style="font-size:16px;font-weight:600;color:var(--text-secondary);margin:2px 0 8px;">${escapeHtml(p.title)}</div>` : ''}
          <div class="tag-row">${roleTags}${p.tier_label ? `<span class="tag">Скилл: ${escapeHtml(p.tier_label)}</span>` : ''}</div>
          ${seesStatus ? `<span class="status-pill" style="margin-top:8px;display:inline-block;">${statusLabel(p.status)}${p.status === 'approved' && !p.is_active ? ' · REQ—OFF' : ''}</span>` : ''}
          ${author}
        </div>
      </div>
      ${isOwner ? `<div class="container">${ownerNotice(p)}</div>` : ''}

      <div class="pf-layout container">
        <div class="pf-left">
          ${
            p.description
              ? `<div class="profile-block"><h3>Описание</h3><p style="white-space:pre-wrap;">${escapeHtml(p.description)}</p></div>`
              : ''
          }
          ${
            p.services_text || services
              ? `<div class="profile-block"><h3>Услуги</h3>${
                  p.services_text ? `<p style="white-space:pre-wrap;">${escapeHtml(p.services_text)}</p>` : ''
                }${services ? `<ul>${services}</ul>` : ''}</div>`
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

        <div class="pf-right">
          ${media ? `<div class="pf-gallery">${media}</div>` : ''}
          <div class="sidebar-card" style="position:static;">
            <div class="sidebar-price">${formatPrice(p.price_cents, p.currency)}</div>
            <p class="text-muted" style="margin-top:0;">Контакт: ${escapeHtml(p.contact)}</p>
            <div id="order-area"></div>
          </div>
        </div>
      </div>
    `;

    // Tap a photo to see it full size.
    root.querySelectorAll('img[data-zoom]').forEach((img) => {
      img.addEventListener('click', () => {
        const box = document.createElement('div');
        box.className = 'pf-lightbox';
        box.innerHTML = `<img src="${escapeHtml(img.getAttribute('src'))}" alt="" />`;
        box.addEventListener('click', () => box.remove());
        document.body.appendChild(box);
      });
    });

    if (isOwner) renderOwnerArea(p);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Не удалось загрузить анкету: ${escapeHtml(err.message)}</div>`;
  }
}

function renderOwnerArea(profile) {
  const area = document.getElementById('order-area');
  if (!area) return;

  area.innerHTML = `
    <p class="text-muted" style="font-size:13px;">Это твоя анкета.</p>
    <a class="btn btn-primary btn-block" href="/create.html?edit=${profile.id}" style="margin-top:12px;">Изменить анкету</a>
    ${
      profile.status === 'approved'
        ? `<button class="btn btn-block" id="active-btn" style="margin-top:12px;">${
            profile.is_active ? 'REQ—OFF · отключить анкету' : 'REQ—ON · включить анкету'
          }</button>`
        : ''
    }
    <button class="btn btn-block" id="delete-btn" style="margin-top:12px;">Удалить анкету</button>
    <div id="owner-msg" class="form-msg"></div>
  `;

  const msg = document.getElementById('owner-msg');

  const activeBtn = document.getElementById('active-btn');
  if (activeBtn) {
    activeBtn.addEventListener('click', async () => {
      activeBtn.disabled = true;
      try {
        await api(`/profiles/${profile.id}/active`, {
          method: 'PATCH',
          auth: true,
          body: { active: !profile.is_active },
        });
        window.location.reload();
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err.message;
        activeBtn.disabled = false;
      }
    });
  }

  document.getElementById('delete-btn').addEventListener('click', async () => {
    if (!window.confirm('Удалить анкету навсегда? Это действие нельзя отменить.')) return;

    const btn = document.getElementById('delete-btn');
    btn.disabled = true;
    try {
      await api(`/profiles/${profile.id}`, { method: 'DELETE', auth: true });
      msg.className = 'form-msg success';
      msg.textContent = 'Анкета удалена.';
      setTimeout(() => {
        window.location.href = '/user.html';
      }, 600);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', loadProfile);
