function profileCard(p) {
  const avatarContent = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(p.name)}" />`
    : initials(p.name);

  const tags = (p.tags || [])
    .slice(0, 3)
    .map((t) => `<span class="tag">${escapeHtml(t)}</span>`)
    .join('');

  return `
    <a class="card" href="/profile.html?id=${p.id}">
      <div class="card-top">
        <div class="avatar">${avatarContent}</div>
        <div>
          <div class="card-name">${escapeHtml(p.name)}</div>
          <div class="card-role">${escapeHtml(p.role_title)}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(p.description)}</div>
      <div class="tag-row">${tags}</div>
      <div class="card-bottom">
        <div class="price">${formatPrice(p.price_cents, p.currency)}</div>
        <span class="btn btn-sm btn-ghost">Открыть →</span>
      </div>
    </a>
  `;
}
