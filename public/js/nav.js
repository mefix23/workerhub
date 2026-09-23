function isStaffUser(u) {
  return !!u && (u.role === 'admin' || u.is_moderator === 1 || u.is_moderator === true);
}

let navRefreshed = false;

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
          <a href="/collabs.html">Коллабы</a>
          <a href="/lobby.html">Общий чат</a>
          ${user ? `<a href="/messages.html">Личные<span id="nav-chat-badge" style="display:none;"></span></a>` : ''}
          ${isStaffUser(user) ? `<a href="/admin.html">Панель</a>` : ''}
          ${
            user
              ? `<div class="nav-user">
                   <a href="/user.html" class="nav-profile-pill" title="Профиль">
                     <span class="nav-avatar">${escapeHtml((user.username || '?').slice(0, 1).toUpperCase())}</span>
                     <span class="nav-profile-meta">
                       <span class="nav-name">${escapeHtml(user.username)}</span>
                       <span class="nav-coins">🪙 ${Number(user.coins) || 0}</span>
                     </span>
                   </a>
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
  } catch (err) {}
}

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  refreshNavUser();
  refreshChatBadge();
  setInterval(refreshChatBadge, 20000);
});
