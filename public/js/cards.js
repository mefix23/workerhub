function roleBadges(p) {
  const labels = (p.role_labels && p.role_labels.length) ? p.role_labels : [p.role_title].filter(Boolean);
  return labels.map((l) => `<span class="tag">${escapeHtml(l)}</span>`).join('');
}

function profileCard(p) {
  const avatarContent = p.avatar_url
    ? `<img src="${escapeHtml(p.avatar_url)}" alt="${escapeHtml(p.name)}" />`
    : initials(p.name);

  return `
    <a class="card" href="/profile.html?id=${p.id}" style="${escapeHtml((p.appearance && p.appearance.frame_css) || '')}">
      <div class="card-top">
        <div class="avatar">${avatarContent}</div>
        <div>
          <div class="card-name">${escapeHtml(p.name)}</div>
          ${p.title ? `<div style="font-size:13.5px;font-weight:600;color:var(--text-secondary);margin:2px 0 6px;">${escapeHtml(p.title)}</div>` : ''}
          <div class="tag-row">${roleBadges(p)}${p.tier_label ? `<span class="tag">Скилл: ${escapeHtml(p.tier_label)}</span>` : ''}</div>
        </div>
      </div>
      <div class="card-desc">${escapeHtml(p.services_text || p.description || '')}</div>
      <div class="card-bottom">
        <div class="price">${formatPrice(p.price_cents, p.currency)}${
          p.rating_count
            ? ` <span class="text-muted" style="font-size:13px;font-weight:500;">★ ${p.rating_avg} (${p.rating_count})</span>`
            : ''
        }</div>
        <span class="btn btn-sm btn-ghost">Открыть →</span>
      </div>
    </a>
  `;
}
