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

    const look = p.appearance || {};
    const skinCss = `${look.bg_css || ''}${look.font_css || ''}${look.frame_css || ''}`;
    const skinStyle = skinCss ? `${skinCss}padding:8px 0;margin:8px 12px;overflow:hidden;` : '';

    root.innerHTML = `
      <div class="pf-skin" style="${escapeHtml(skinStyle)}">
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
      <div class="container" id="reviews-root" style="padding-bottom:32px;"></div>
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
    loadReviews(p, user, isOwner);
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
    <div id="look-editor" style="margin-top:16px;"></div>
    <div id="owner-msg" class="form-msg"></div>
  `;

  renderLookEditor(profile);

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

// ---------- decorations bought in the shop ----------

async function renderLookEditor(profile) {
  const box = document.getElementById('look-editor');
  if (!box) return;

  let shop;
  try {
    shop = await api('/shop', { auth: true });
  } catch (err) {
    return;
  }
  const owned = shop.items.filter((i) => i.owned);
  const current = profile.appearance || {};
  const select = (type, label) => {
    const opts = ['<option value="">По умолчанию</option>']
      .concat(
        owned
          .filter((i) => i.type === type)
          .map(
            (i) =>
              `<option value="${escapeHtml(i.id)}"${current[type] === i.id ? ' selected' : ''}>${escapeHtml(i.name)}</option>`
          )
      )
      .join('');
    return `<label style="display:block;font-size:13px;margin-top:8px;">${label}
      <select data-look="${type}" style="display:block;width:100%;margin-top:4px;padding:8px 10px;border-radius:var(--radius-md);border:1px solid var(--border-strong);background:var(--bg-input);color:inherit;color-scheme:dark;">${opts}</select></label>`;
  };

  box.innerHTML = `
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <div style="font-weight:700;margin-bottom:2px;">Оформление</div>
      ${select('bg', 'Фон')}${select('font', 'Шрифт')}${select('frame', 'Рамка')}
      <button class="btn btn-block" id="look-save" style="margin-top:12px;">Сохранить оформление</button>
      <p class="text-muted" style="font-size:12.5px;margin:8px 0 0;">
        У тебя 🪙 ${shop.coins}. Больше вариантов в <a href="/shop.html">магазине</a>.
      </p>
    </div>
  `;

  document.getElementById('look-save').addEventListener('click', async () => {
    const body = {};
    box.querySelectorAll('select[data-look]').forEach((sel) => {
      body[sel.getAttribute('data-look')] = sel.value || null;
    });
    const msg = document.getElementById('owner-msg');
    try {
      await api(`/profiles/${profile.id}/appearance`, { method: 'PATCH', auth: true, body });
      window.location.reload();
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
    }
  });
}

// ---------- reviews (appear only after a moderator approves them) ----------

function starsText(n) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

async function loadReviews(profile, user, isOwner) {
  const box = document.getElementById('reviews-root');
  if (!box) return;

  let data;
  try {
    data = await api(`/profiles/${profile.id}/reviews`, { auth: true });
  } catch (err) {
    return;
  }
  const { reviews, summary, mine } = data;
  const staff = typeof isStaffUser === 'function' && isStaffUser(user);
  const isPublic = profile.status === 'approved' && profile.is_active;

  const list = reviews
    .map(
      (r) => `
      <div class="profile-block" style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <div>
            <b style="letter-spacing:1px;color:#fbbf24;">${starsText(r.rating)}</b>
            <a href="/user.html?id=${r.author_id}" style="font-weight:600;margin-left:6px;">${escapeHtml(r.author_name)}</a>
          </div>
          <span class="text-muted" style="font-size:12.5px;">${escapeHtml(String(r.created_at).slice(0, 10))}</span>
        </div>
        <p style="white-space:pre-wrap;margin:6px 0 0;">${escapeHtml(r.text)}</p>
        ${
          user && (user.id === r.author_id || staff)
            ? `<button class="btn btn-sm btn-ghost" data-del-review="${r.id}" style="margin-top:8px;">Удалить</button>`
            : ''
        }
      </div>`
    )
    .join('');

  let form = '';
  if (!isPublic) {
    form = '';
  } else if (!user) {
    form = `<p class="text-muted">Чтобы оставить отзыв, <a href="/login.html">войди в аккаунт</a>.</p>`;
  } else if (isOwner) {
    form = '';
  } else if (mine && mine.status === 'pending') {
    form = noticeBox('⏳ Твой отзыв на модерации. После проверки он появится здесь, а тебе придут монеты.');
  } else if (mine && mine.status === 'rejected') {
    form =
      noticeBox(`❌ Модератор отклонил твой отзыв.${mine.reject_reason ? ' Причина: ' + escapeHtml(mine.reject_reason) : ''}`) +
      `<button class="btn btn-sm btn-ghost" data-del-review="${mine.id}" style="margin-top:10px;">Удалить и написать заново</button>`;
  } else if (!mine) {
    form = `
      <div class="profile-block">
        <h3>Оставить отзыв</h3>
        <div id="star-pick" style="font-size:28px;letter-spacing:4px;cursor:pointer;color:#fbbf24;user-select:none;">
          ${[1, 2, 3, 4, 5].map((n) => `<span data-star="${n}">☆</span>`).join('')}
        </div>
        <textarea id="review-text" rows="3" maxlength="500" placeholder="Как всё прошло? От 10 символов" style="width:100%;margin-top:10px;"></textarea>
        <button class="btn btn-primary" id="review-send" style="margin-top:10px;">Отправить на модерацию</button>
        <div id="review-msg" class="form-msg"></div>
      </div>`;
  }

  box.innerHTML = `
    <div class="section-head" style="margin-top:8px;">
      <div>
        <h2>Отзывы</h2>
        <p>${
          summary.count
            ? `<span style="color:#fbbf24;font-weight:700;">★ ${summary.avg}</span> · ${summary.count} шт.`
            : 'Пока нет отзывов'
        }</p>
      </div>
    </div>
    ${list || ''}
    ${form}
  `;

  // star picker
  let rating = 0;
  const stars = box.querySelectorAll('#star-pick span');
  const paint = () => stars.forEach((s) => (s.textContent = Number(s.dataset.star) <= rating ? '★' : '☆'));
  stars.forEach((s) =>
    s.addEventListener('click', () => {
      rating = Number(s.dataset.star);
      paint();
    })
  );

  const send = document.getElementById('review-send');
  if (send) {
    send.addEventListener('click', async () => {
      const msg = document.getElementById('review-msg');
      msg.className = 'form-msg';
      if (!rating) {
        msg.className = 'form-msg error';
        msg.textContent = 'Поставь оценку звёздами.';
        return;
      }
      send.disabled = true;
      try {
        await api(`/profiles/${profile.id}/reviews`, {
          method: 'POST',
          auth: true,
          body: { rating, text: document.getElementById('review-text').value },
        });
        loadReviews(profile, user, isOwner);
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err.message;
        send.disabled = false;
      }
    });
  }

  box.querySelectorAll('[data-del-review]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      if (!window.confirm('Удалить отзыв?')) return;
      try {
        await api(`/reviews/${btn.getAttribute('data-del-review')}`, { method: 'DELETE', auth: true });
        loadReviews(profile, user, isOwner);
      } catch (err) {
        window.alert(err.message);
      }
    })
  );
}

document.addEventListener('DOMContentLoaded', loadProfile);
