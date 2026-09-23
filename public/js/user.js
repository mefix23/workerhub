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
          ${
            data.is_self
              ? `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                   <a class="btn btn-primary btn-sm" href="/create.html">Создать анкету</a>
                   <a class="btn btn-sm" href="/shop.html">Магазин</a>
                   <a class="btn btn-sm" href="/support.html">Помощь</a>
                   <a class="btn btn-sm" href="/lobby.html">Общий чат</a>
                 </div>`
              : `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap;">
                   <button class="btn btn-sm btn-primary" id="btn-chat-user" data-uid="${u.id}">Написать</button>
                 </div>`
          }
        </div>
      </div>

      ${
        data.is_self
          ? `<div class="profile-block" style="margin-top:24px;"><h3>Монеты</h3><p style="margin:0;"><b style="color:#fbbf24;">🪙 ${Number(u.coins) || 0}</b> · <a href="/shop.html">Магазин</a> · <a href="/faq.html">Как получить монеты</a></p></div>
             <div class="profile-block" style="margin-top:16px;" id="notif-block"><h3>Уведомления</h3><div id="notif-list" class="text-muted">Загрузка…</div></div>`
          : ''
      }
      ${showWarns ? warnBlock({ ...data, user: u }) : ''}

      <div class="section-head" style="margin-top:32px;">
        <div><h2>${data.is_self ? 'Мои анкеты' : 'Анкеты'}</h2></div>
      </div>
      <div class="grid">${tiles}</div>

      ${data.is_self ? '<div class="section-head" style="margin-top:32px;"><div><h2>Избранное</h2><p>Чужие анкеты, которые ты хочешь купить</p></div></div><div class="grid" id="favorites-grid"><div class="loading">Загрузка…</div></div>' : ''}
    `;

    
    if (data.is_self) {
      loadFavorites();
      loadNotifications();
      
    }
    const chatBtn = document.getElementById('btn-chat-user');
    if (chatBtn) {
      chatBtn.addEventListener('click', async () => {
        if (!getToken()) {
          window.location.href = '/login.html';
          return;
        }
        chatBtn.disabled = true;
        try {
          const res = await api('/chat/open', {
            method: 'POST',
            auth: true,
            body: { userId: Number(chatBtn.getAttribute('data-uid')) },
          });
          window.location.href = `/messages.html?id=${res.conversation.id}`;
        } catch (err) {
          window.alert(err.message);
          chatBtn.disabled = false;
        }
      });
    }
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Профиль не найден: ${escapeHtml(err.message)}</div>`;
  }
}

function youtubeThumb(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.split('/').filter(Boolean)[0];
    else if (host.includes('youtube')) id = u.searchParams.get('v') || u.pathname.split('/')[2];
    if (id && /^[\w-]{6,}$/.test(id)) return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  } catch (e) {}
  return null;
}

async function loadWorks(userId, isSelf) {
  const box = document.getElementById('works-grid');
  if (!box) return;
  try {
    const { works } = await api(`/works/user/${userId}`, { auth: !!getToken() });
    if (!works.length) {
      box.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">${
        isSelf ? 'Пока нет видео. Нажми «Выложить видео».' : 'Видео пока нет.'
      }</div>`;
      return;
    }
    box.innerHTML = works
      .map((w) => {
        const thumb = youtubeThumb(w.video_url);
        const media = thumb
          ? `<img src="${escapeHtml(thumb)}" alt="" />`
          : `<video src="${escapeHtml(w.video_url)}" muted preload="metadata"></video>`;
        return `
          <a class="work-tile" href="/feed.html#${w.id}" title="${escapeHtml(w.caption || '')}">
            ${media}
            <div class="work-tile-meta">♥ ${w.likes_count || 0} · 💬 ${w.comments_count || 0}</div>
          </a>`;
      })
      .join('');
  } catch (err) {
    box.innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Не удалось загрузить видео.</div>`;
  }
}

function setupUploadModal() {
  const modal = document.getElementById('upload-modal');
  if (!modal) return;
  const open = () => modal.classList.add('open');
  const close = () => modal.classList.remove('open');
  ['btn-upload-work', 'btn-upload-work-2'].forEach((id) => {
    const b = document.getElementById(id);
    if (b) b.addEventListener('click', open);
  });
  document.getElementById('upload-cancel').addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });

  document.getElementById('upload-send').addEventListener('click', async () => {
    const msg = document.getElementById('upload-msg');
    const fileInput = document.getElementById('work-file');
    const urlInput = document.getElementById('work-url');
    const caption = document.getElementById('work-caption').value.trim();
    const file = fileInput.files && fileInput.files[0];
    const url = (urlInput.value || '').trim();
    msg.className = 'form-msg';
    msg.textContent = '';

    if (!file && !url) {
      msg.className = 'form-msg error';
      msg.textContent = 'Выбери файл или вставь ссылку.';
      return;
    }
    if (file && file.size > 40 * 1024 * 1024) {
      msg.className = 'form-msg error';
      msg.textContent = 'Файл слишком большой (макс. 40 МБ).';
      return;
    }

    const btn = document.getElementById('upload-send');
    btn.disabled = true;
    try {
      let work;
      if (file) {
        const fd = new FormData();
        fd.append('video', file);
        fd.append('caption', caption);
        const token = getToken();
        const res = await fetch('/api/works', {
          method: 'POST',
          headers: token ? { Authorization: 'Bearer ' + token } : {},
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Ошибка загрузки');
        work = data.work;
      } else {
        const data = await api('/works', {
          method: 'POST',
          auth: true,
          body: { videoUrl: url, caption },
        });
        work = data.work;
      }
      msg.className = 'form-msg success';
      msg.textContent = 'Опубликовано!';
      setTimeout(() => {
        close();
        window.location.reload();
      }, 500);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      btn.disabled = false;
    }
  });
}

async function loadNotifications() {
  const box = document.getElementById('notif-list');
  if (!box) return;
  try {
    const data = await api('/notifications', { auth: true });
    if (!data.notifications.length) {
      box.innerHTML = '<p class="text-muted" style="margin:0;">Пока нет уведомлений.</p>';
      return;
    }
    box.innerHTML = data.notifications
      .slice(0, 15)
      .map(
        (n) => `
      <div class="notif-item${n.is_read ? '' : ' unread'}">
        ${escapeHtml(n.body)}
        <div class="text-muted" style="font-size:12px;margin-top:2px;">${escapeHtml(String(n.created_at).slice(0, 16))}
          ${n.work_id ? ` · <a href="/user.html">смотреть</a>` : ''}
        </div>
      </div>`
      )
      .join('');
    await api('/notifications/read', { method: 'POST', auth: true, body: {} });
  } catch (err) {
    box.innerHTML = '<p class="text-muted">Не удалось загрузить уведомления.</p>';
  }
}

async function loadFavorites() {
  const box = document.getElementById('favorites-grid');
  if (!box) return;
  try {
    const { profiles } = await api('/profiles/favorites/mine', { auth: true });
    box.innerHTML = profiles.length
      ? profiles.map((p) => profileCard(p)).join('')
      : '<div class="empty-state">Пока пусто. Жми ♡ на анкете, чтобы добавить сюда.</div>';
  } catch (err) {
    box.innerHTML = `<div class="empty-state">Не удалось загрузить избранное.</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadUser);
