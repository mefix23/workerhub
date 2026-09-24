const PF_TIERS = ['low', 'below_avg', 'avg', 'above_avg', 'high', 'excellent'];

// Extract YouTube video id from common URL forms (youtu.be, watch?v=, embed/, shorts/).
function youtubeEmbedId(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtube-nocookie.com') {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch (e) {
    /* ignore */
  }
  return null;
}

function tierBar(p) {
  if (!p.tier) return '';
  const idx = PF_TIERS.indexOf(p.tier);
  if (idx === -1) return '';
  const bars = PF_TIERS.map((t, i) => `<span class="${i <= idx ? 'on' : ''}"></span>`).join('');
  return `
    <div class="pf-tierbar-wrap">
      <div class="pf-tierbar-label">Тир скилла</div>
      <div class="pf-tierbar">${bars}</div>
      <div class="pf-tierbar-name">${escapeHtml(p.tier_label)}</div>
    </div>
  `;
}

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
      .map((m) => {
        if (m.type === 'image') {
          return `<div class="pf-item pf-img"><img src="${escapeHtml(m.url)}" alt="Работа" data-zoom="1" /></div>`;
        }
        const yt = youtubeEmbedId(m.url);
        if (yt) {
          return `<div class="pf-item pf-vid"><div class="pf-embed"><iframe src="https://www.youtube.com/embed/${escapeHtml(yt)}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" title="YouTube"></iframe></div></div>`;
        }
        return `<div class="pf-item pf-vid"><a class="pf-video" href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer"><span>▶ Смотреть видео</span><small>${escapeHtml(m.url)}</small></a></div>`;
      })
      .join('');

    const skinCss = `${(p.appearance && p.appearance.bg_css) || ''}${(p.appearance && p.appearance.font_css) || ''}`;
    const frameCss = (p.appearance && p.appearance.frame_css) || '';

    const isFav = !!p.is_favorited;
    const favBtn =
      user && !isOwner
        ? `<button class="pf-icon-btn${isFav ? ' active' : ''}" id="fav-btn" title="В избранное" aria-label="В избранное">${isFav ? '♥' : '♡'}</button>`
        : '';

    root.innerHTML = `
      <div class="pf-card" style="${escapeHtml(skinCss)}${escapeHtml(frameCss)}">
        <div class="pf-banner"></div>
        <div class="pf-body-pad">
        <div class="pf-top">
          <div class="pf-top-left">
            <div class="pf-avatar-frame">${avatarContent}</div>
            <div>
              <div class="pf-name-row"><h1 class="profile-name" style="margin:0;">${escapeHtml(p.name)}</h1></div>
              ${p.title ? `<div style="font-size:15px;font-weight:500;color:var(--text-secondary);margin:4px 0 8px;">${escapeHtml(p.title)}</div>` : ''}
              <div class="tag-row">${roleTags}</div>
              ${
                p.rating_count
                  ? `<div class="pf-rating">★ ${p.rating_avg} <span class="text-muted" style="font-weight:400;">(${p.rating_count} отзывов)</span></div>`
                  : ''
              }
              ${seesStatus ? `<span class="status-pill" style="margin-top:8px;display:inline-block;">${statusLabel(p.status)}${p.status === 'approved' && !p.is_active ? ' · REQ—OFF' : ''}</span>` : ''}
              ${author}
              ${tierBar(p)}
            </div>
          </div>
          ${favBtn}
        </div>

        ${isOwner ? ownerNotice(p) : ''}

        <div class="pf-layout">
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
              <div class="pf-actions" id="order-area"></div>
            </div>
          </div>
        </div>

        </div>
        <div id="reviews-root"></div>
      </div>
    `;

    const favBtnEl = document.getElementById('fav-btn');
    if (favBtnEl) {
      favBtnEl.addEventListener('click', async () => {
        favBtnEl.disabled = true;
        try {
          const res = await api(`/profiles/${p.id}/favorite`, { method: 'POST', auth: true });
          favBtnEl.textContent = res.favorited ? '♥' : '♡';
          favBtnEl.classList.toggle('active', res.favorited);
          if (typeof window.showToast === 'function') {
            window.showToast(res.favorited ? 'Добавлено в избранное' : 'Убрано из избранного');
          }
        } catch (err) {
          if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
        } finally {
          favBtnEl.disabled = false;
        }
      });
    }

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

    if (isOwner) {
      renderOwnerArea(p);
    } else {
      renderRequestArea(p, user);
    }
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
    <div id="requests-box" style="margin-top:16px;"></div>
    <div id="look-editor" style="margin-top:16px;"></div>
    <div id="owner-msg" class="form-msg"></div>
  `;

  renderLookEditor(profile);
  renderRequestsBox(profile);

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

// Owner: requests received on this anketa (opening this view marks them seen).
async function renderRequestsBox(profile) {
  const box = document.getElementById('requests-box');
  if (!box || profile.status !== 'approved') return;

  let data;
  try {
    data = await api(`/profiles/${profile.id}/requests`, { auth: true });
  } catch (err) {
    return;
  }
  if (!data || !Array.isArray(data.requests) || !data.requests.length) return;

  box.innerHTML = `
    <div style="border-top:1px solid var(--border);padding-top:14px;">
      <div style="font-weight:700;margin-bottom:8px;">Заявки (${data.requests.length})</div>
      ${data.requests
        .map(
          (r) => `
        <div style="border:1px solid var(--border);border-radius:12px;padding:10px 12px;margin-bottom:8px;font-size:13.5px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">
            <div>
              <a href="/user.html?id=${r.buyer_id}" style="font-weight:600;">${escapeHtml(r.buyer_name)}</a>
              <span class="text-muted" style="font-size:12px;">· ${escapeHtml(String(r.created_at).slice(0, 16))}</span>
            </div>
            <button class="btn btn-sm" data-chat-user="${r.buyer_id}">Чат</button>
          </div>
          <p style="white-space:pre-wrap;margin:6px 0 0;">${escapeHtml(r.message)}</p>
        </div>`
        )
        .join('')}
    </div>
  `;

  box.querySelectorAll('[data-chat-user]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const data = await api('/chat/open', {
          method: 'POST',
          auth: true,
          body: { userId: Number(btn.getAttribute('data-chat-user')) },
        });
        window.location.href = `/messages.html?id=${data.conversation.id}`;
      } catch (err) {
        window.alert(err.message);
        btn.disabled = false;
      }
    });
  });
}

// ---------- "Оставить заявку" — the new mechanic that replaced "Заказать" ----------
// The buyer writes what he needs; the creator sees it on his own anketa page
// (requests received) and reaches out via the contact shown on it. Nothing is
// paid or ordered automatically — it's just a structured "I'm interested".

function renderRequestArea(profile, user) {
  const area = document.getElementById('order-area');
  if (!area) return;

  if (!profile.status || profile.status !== 'approved' || !profile.is_active) {
    return; // hidden/unpublished profiles don't take requests
  }

  if (!user) {
    area.innerHTML = `<a class="btn btn-primary btn-block" href="/login.html">Войти, чтобы написать</a>`;
    return;
  }

  const ownerId = profile.user_id || (profile.owner && profile.owner.id);
  area.innerHTML = `
    <button class="btn btn-primary btn-block" id="chat-open-btn">Написать в чат</button>
    <button class="btn btn-block" id="request-open" style="margin-top:8px;">Оставить заявку</button>
    <div id="request-form" style="display:none;margin-top:12px;">
      <textarea id="request-text" rows="3" maxlength="500" placeholder="Что нужно сделать? От 5 символов"></textarea>
      <button class="btn btn-primary btn-block" id="request-send" style="margin-top:8px;">Отправить креатору</button>
    </div>
    <div id="request-msg" class="form-msg"></div>
  `;

  document.getElementById('chat-open-btn').addEventListener('click', async () => {
    const btn = document.getElementById('chat-open-btn');
    const msg = document.getElementById('request-msg');
    if (!ownerId) {
      msg.className = 'form-msg error';
      msg.textContent = 'Не удалось найти автора анкеты.';
      return;
    }
    btn.disabled = true;
    try {
      const data = await api('/chat/open', {
        method: 'POST',
        auth: true,
        body: { userId: ownerId },
      });
      window.location.href = `/messages.html?id=${data.conversation.id}`;
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });

  document.getElementById('request-open').addEventListener('click', () => {
    document.getElementById('request-open').style.display = 'none';
    document.getElementById('request-form').style.display = 'block';
  });

  document.getElementById('request-send').addEventListener('click', async () => {
    const msg = document.getElementById('request-msg');
    msg.className = 'form-msg';
    const btn = document.getElementById('request-send');
    btn.disabled = true;
    try {
      await api(`/profiles/${profile.id}/requests`, {
        method: 'POST',
        auth: true,
        body: { message: document.getElementById('request-text').value },
      });
      document.getElementById('request-form').innerHTML =
        '<p class="text-muted" style="font-size:13px;">Заявка отправлена. Креатор увидит её в своей анкете и сам с тобой свяжется.</p>';
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
      <article class="review-card">
        <div class="review-card-top">
          <div class="review-card-who">
            <span class="review-stars">${starsText(r.rating)}</span>
            <a class="review-author" href="/user.html?id=${r.author_id}">${escapeHtml(r.author_name)}</a>
          </div>
          <time class="review-date">${escapeHtml(String(r.created_at).slice(0, 10))}</time>
        </div>
        <p class="review-text">${escapeHtml(r.text)}</p>
        ${
          user && (user.id === r.author_id || staff)
            ? `<button class="btn btn-sm btn-ghost review-del" data-del-review="${r.id}">Удалить</button>`
            : ''
        }
      </article>`
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
      <div class="review-form">
        <div class="review-form-title">Оставить отзыв</div>
        <p class="review-form-hint">После модерации отзыв появится здесь</p>
        <div id="star-pick" class="review-stars-pick">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="review-star-btn" data-star="${n}" aria-label="${n}">☆</button>`).join('')}
        </div>
        <textarea id="review-text" class="review-textarea" rows="3" maxlength="500" placeholder="Как всё прошло? От 10 символов"></textarea>
        <button class="btn btn-primary" id="review-send">Отправить на модерацию</button>
        <div id="review-msg" class="form-msg"></div>
      </div>`;
  }

  box.innerHTML = `
    <div class="reviews-section">
      <div class="reviews-head">
        <div>
          <h2 class="reviews-title">Отзывы</h2>
          <p class="reviews-sub">${
            summary.count
              ? `<span class="reviews-avg">★ ${summary.avg}</span> · ${summary.count} ${summary.count === 1 ? 'отзыв' : 'отзывов'}`
              : 'Пока нет отзывов — будь первым'
          }</p>
        </div>
      </div>
      <div class="reviews-list">${list || (summary.count ? '' : '')}</div>
      ${form}
    </div>
  `;

  // star picker
  let rating = 0;
  const stars = box.querySelectorAll('#star-pick [data-star]');
  const paint = () =>
    stars.forEach((s) => {
      const on = Number(s.dataset.star) <= rating;
      s.textContent = on ? '★' : '☆';
      s.classList.toggle('on', on);
    });
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
