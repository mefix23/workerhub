function isStaffUser(u) {
  return !!u && (u.role === 'admin' || u.is_moderator === 1 || u.is_moderator === true);
}

let navRefreshed = false;

// Re-checks the saved login with the server, so the menu always shows the
// current role, and a stale login (e.g. after the database was reset) is
// cleared instead of causing "Invalid session" errors later.
async function refreshNavUser() {
  if (navRefreshed || !getToken()) return;
  navRefreshed = true;
  try {
    const { user } = await api('/auth/me', { auth: true });
    if (JSON.stringify(user) !== JSON.stringify(getStoredUser())) {
      setStoredUser(user);
      renderNav();
    }
  } catch (err) {
    const dead = [
      'Invalid session.',
      'Invalid or expired token.',
      'Authentication required.',
      'This account has been blocked.',
    ];
    if (dead.includes(err.message)) {
      clearToken();
      renderNav();
    }
  }
}

function renderNav() {
  const el = document.getElementById('nav-root');
  if (!el) return;

  const user = getStoredUser();

  el.innerHTML = `
    <div class="nav">
      <div class="nav-inner">
        <a class="logo" href="/">WORKERHUB</a>
        <div class="nav-links">
          <a href="/catalog.html">Каталог</a>
          <a href="/feed.html">Лента</a>
          <a href="/collabs.html">Коллабы</a>
          <a href="/create.html">Создать анкету</a>
          <a href="/shop.html">Магазин</a>
          ${user ? `<a href="/messages.html">Чаты<span id="nav-chat-badge" style="display:none;"></span></a>` : ''}
          ${user ? `<a href="/user.html" title="Уведомления">🔔<span id="nav-notif-badge" style="display:none;"></span></a>` : ''}
          <a href="/support.html">Помощь</a>
          ${isStaffUser(user) ? `<a href="/admin.html">Панель</a>` : ''}
          ${
            user
              ? `<div class="nav-user">
                   <a href="/shop.html" title="Монеты" style="font-weight:600;">🪙 ${Number(user.coins) || 0}</a>
                   <a class="text-muted" href="/user.html">${escapeHtml(user.username)}</a>
                   <button class="btn btn-sm btn-ghost" id="nav-logout">Выйти</button>
                 </div>`
              : `<a href="/login.html">Войти</a>
                 <a href="/register.html" class="btn btn-sm btn-primary">Регистрация</a>`
          }
        </div>
      </div>
    </div>
  `;

  const logoutBtn = document.getElementById('nav-logout');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      clearToken();
      window.location.href = '/';
    });
  }
}

function styleBadge(el, n) {
  if (!el) return;
  if (n > 0) {
    el.style.cssText =
      'display:inline-flex;margin-left:4px;min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:var(--accent);color:#fff;font-size:10px;font-weight:700;align-items:center;justify-content:center;';
    el.textContent = n > 99 ? '99+' : String(n);
  } else {
    el.style.display = 'none';
  }
}

async function refreshChatBadge() {
  if (!getToken()) return;
  try {
    const { unread_total } = await api('/chat/unread', { auth: true });
    styleBadge(document.getElementById('nav-chat-badge'), unread_total || 0);
  } catch (err) {
    /* ignore */
  }
}

async function refreshNotifBadge() {
  if (!getToken()) return;
  try {
    const { unread } = await api('/notifications/unread', { auth: true });
    styleBadge(document.getElementById('nav-notif-badge'), unread || 0);
  } catch (err) {
    /* ignore */
  }
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  refreshNavUser();
  refreshChatBadge();
  refreshNotifBadge();
  setInterval(() => {
    refreshChatBadge();
    refreshNotifBadge();
  }, 20000);
});
