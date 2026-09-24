function roleBadges(p) {
  const labels = (p.role_labels && p.role_labels.length) ? p.role_labels : [p.role_title].filter(Boolean);
  return labels.map((l) => `<span class="tag">${escapeHtml(l)}</span>`).join('');
}

function profileCard(p) {
  const avatarContent = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(p.name)}" />`
    : initials(p.name);

  const rating =
    p.rating_count
      ? `<span style="color:var(--warning);font-size:12.5px;font-weight:600;">★ ${p.rating_avg}</span>`
      : '';

  return `
    <a class="card" href="/profile.html?id=${p.id}">
      <div class="card-top">
        <div class="avatar">${avatarContent}</div>
        <div style="min-width:0;">
          <div class="card-name">${escapeHtml(p.name)}</div>
          <div class="tag-row" style="margin-top:6px;">${roleBadges(p)}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(p.description)}</div>
      <div class="card-bottom">
        <div class="price">${formatPrice(p.price_cents, p.currency)}</div>
        ${rating || '<span class="btn btn-sm btn-ghost">Открыть →</span>'}
      </div>
    </a>
  `;
}
