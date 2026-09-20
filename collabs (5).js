function collabCard(c) {
  const totalPercent = 100 + c.deco_percent;
  const displayPercent = c.deco_percent > 0 ? totalPercent : c.gp_percent;
  const cappedForBar = Math.min(displayPercent, 200);

  return `
    <a class="card" href="/collab.html?id=${c.id}">
      <div class="card-name">${escapeHtml(c.title)}</div>
      <div class="card-desc">${escapeHtml(c.description)}</div>
      <div class="progress-bar"><div class="progress-bar-fill" style="width:${Math.min(cappedForBar, 100)}%;"></div></div>
      <div class="card-bottom">
        <span class="tag">${escapeHtml(collabStatusLabel(c.status))}</span>
        <span class="price">${displayPercent}%</span>
      </div>
    </a>
  `;
}

async function loadCollabs() {
  const grid = document.getElementById('collabs-grid');
  try {
    const { collabs } = await api('/collabs');
    if (!collabs.length) {
      grid.innerHTML = `<div class="empty-state">Пока нет коллабов. <a href="/create-collab.html">Выложи первый</a>.</div>`;
      return;
    }
    grid.innerHTML = collabs.map(collabCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">Ошибка загрузки: ${escapeHtml(err.message)}</div>`;
  }
}

document.addEventListener('DOMContentLoaded', loadCollabs);
