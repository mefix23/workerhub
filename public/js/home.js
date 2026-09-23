async function loadFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  try {
    const { profiles } = await api('/profiles?limit=6');
    const stat = document.getElementById('stat-profiles');
    if (stat) stat.textContent = profiles.length >= 6 ? '6+' : String(profiles.length);

    if (!profiles.length) {
      grid.innerHTML = `<div class="empty-state">Пока нет анкет. Зайди в <a href="/user.html">профиль</a> и создай первую.</div>`;
      return;
    }
    grid.innerHTML = profiles.map(profileCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Не удалось загрузить каталог: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadFeatured();
  const form = document.getElementById('hero-search-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const q = document.getElementById('hero-search-input').value.trim();
      window.location.href = q ? `/catalog.html?q=${encodeURIComponent(q)}` : '/catalog.html';
    });
  }
});
