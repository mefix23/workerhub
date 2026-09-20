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
          <a href="/collabs.html">Коллабы</a>
          <a href="/create.html">Создать анкету</a>
          ${isStaffUser(user) ? `<a href="/admin.html">Панель</a>` : ''}
          ${
            user
              ? `<div class="nav-user">
                   <span class="text-muted">${escapeHtml(user.username)}</span>
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

document.addEventListener('DOMContentLoaded', () => {
  renderNav();
  refreshNavUser();
});
