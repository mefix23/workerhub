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

document.addEventListener('DOMContentLoaded', renderNav);
