let searchDebounce = null;

async function loadCatalog(q) {
  const grid = document.getElementById('catalog-grid');
  grid.innerHTML = `<div class="loading">Загрузка…</div>`;

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const { profiles } = await api(`/profiles?${params.toString()}`);

    if (!profiles.length) {
      grid.innerHTML = `<div class="empty-state">Ничего не найдено. Попробуй другой запрос.</div>`;
      return;
    }
    grid.innerHTML = profiles.map(profileCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get('q') || '';

  const input = document.getElementById('catalog-search-input');
  input.value = initialQ;

  loadCatalog(initialQ);

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const q = input.value.trim();
      const url = new URL(window.location);
      if (q) url.searchParams.set('q', q);
      else url.searchParams.delete('q');
      window.history.replaceState({}, '', url);
      loadCatalog(q);
    }, 300);
  });
});
