let searchDebounce = null;
let selectedRoles = [];

async function loadRoleFilter() {
  const container = document.getElementById('role-filter');
  try {
    const { roles } = await api('/roles');
    const params = new URLSearchParams(window.location.search);
    selectedRoles = (params.get('role') || '').split(',').filter(Boolean);

    container.innerHTML = roles
      .map(
        (r) => `
        <label class="role-check">
          <input type="checkbox" value="${escapeHtml(r.slug)}" ${selectedRoles.includes(r.slug) ? 'checked' : ''} />
          <span>${escapeHtml(r.label)}</span>
        </label>
      `
      )
      .join('');

    container.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
      cb.addEventListener('change', () => {
        selectedRoles = Array.from(container.querySelectorAll('input:checked')).map((el) => el.value);
        syncUrlAndReload();
      });
    });
  } catch (err) {
    container.innerHTML = '';
  }
}

function syncUrlAndReload() {
  const input = document.getElementById('catalog-search-input');
  const q = input.value.trim();
  const url = new URL(window.location);
  if (q) url.searchParams.set('q', q);
  else url.searchParams.delete('q');
  if (selectedRoles.length) url.searchParams.set('role', selectedRoles.join(','));
  else url.searchParams.delete('role');
  window.history.replaceState({}, '', url);
  loadCatalog(q, selectedRoles);
}

async function loadCatalog(q, roles) {
  const grid = document.getElementById('catalog-grid');
  grid.innerHTML = `<div class="loading">Загрузка…</div>`;

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (roles && roles.length) params.set('role', roles.join(','));
    const { profiles } = await api(`/profiles?${params.toString()}`);

    if (!profiles.length) {
      grid.innerHTML = `<div class="empty-state">Ничего не найдено. Попробуй другой запрос или фильтр.</div>`;
      return;
    }
    grid.innerHTML = profiles.map(profileCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get('q') || '';

  const input = document.getElementById('catalog-search-input');
  input.value = initialQ;

  await loadRoleFilter();
  loadCatalog(initialQ, selectedRoles);

  input.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(syncUrlAndReload, 300);
  });
});
