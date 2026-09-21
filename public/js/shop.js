const SHOP_SECTIONS = [
  ['bg', 'Фоны анкеты'],
  ['font', 'Шрифты'],
  ['frame', 'Рамки'],
];

function waitText(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.ceil((sec % 3600) / 60);
  return h ? `${h} ч ${m} мин` : `${m} мин`;
}

function shopPreview(item) {
  if (item.type === 'bg') return `<div class="shop-preview" style="${escapeHtml(item.css)}">Фон</div>`;
  if (item.type === 'font') return `<div class="shop-preview" style="${escapeHtml(item.css)}">Аа Бб Вв 123</div>`;
  return `<div class="shop-preview" style="${escapeHtml(item.css)}">Рамка</div>`;
}

async function loadShop() {
  const root = document.getElementById('shop-root');
  const logged = !!getToken() && !!getStoredUser();

  let data;
  try {
    data = await api('/shop', { auth: true });
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Не удалось загрузить магазин: ${escapeHtml(err.message)}</div>`;
    return;
  }

  const r = data.rewards;
  const dailyBtn = logged
    ? data.daily_wait_seconds > 0
      ? `<button class="btn" disabled>Бонус через ${waitText(data.daily_wait_seconds)}</button>`
      : `<button class="btn btn-primary" id="daily-btn">Получить бонус +${r.daily} 🪙</button>`
    : `<a class="btn btn-primary" href="/login.html">Войти, чтобы получать монеты</a>`;

  const sections = SHOP_SECTIONS.map(([type, title]) => {
    const cards = data.items
      .filter((i) => i.type === type)
      .map(
        (i) => `
        <div class="shop-item">
          ${shopPreview(i)}
          <div><div class="shop-name">${escapeHtml(i.name)}</div><div class="shop-price">🪙 ${i.price}</div></div>
          ${
            i.owned
              ? '<button class="btn btn-sm" disabled>Куплено ✓</button>'
              : logged
              ? `<button class="btn btn-sm btn-primary" data-buy="${escapeHtml(i.id)}">Купить</button>`
              : '<a class="btn btn-sm" href="/login.html">Войти</a>'
          }
        </div>`
      )
      .join('');
    return `<h3 style="margin:24px 0 12px;">${title}</h3><div class="shop-grid">${cards}</div>`;
  }).join('');

  const history = (data.history || [])
    .map(
      (h) =>
        `<li><span>${escapeHtml(h.reason)}</span><span class="${h.amount > 0 ? 'plus' : 'minus'}">${h.amount > 0 ? '+' : ''}${h.amount} 🪙</span></li>`
    )
    .join('');

  root.innerHTML = `
    <div class="section-head">
      <div>
        <h2>Магазин</h2>
        <p>Украшения для анкеты за внутренние монеты. За реальные деньги монеты купить нельзя.</p>
      </div>
    </div>

    <div class="profile-block" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;">
      <div>
        <div class="text-muted" style="font-size:13px;">Твой баланс</div>
        <div class="sidebar-price">${logged ? '🪙 ' + data.coins : '—'}</div>
      </div>
      <div>${dailyBtn}</div>
    </div>

    <div class="profile-block">
      <h3>Как получить монеты</h3>
      <ul class="shop-earn">
        <li>Ежедневный бонус: +${r.daily} 🪙 раз в 24 часа</li>
        <li>Модератор одобрил твою анкету: +${r.profileApproved} 🪙 (один раз за анкету)</li>
        <li>Модератор одобрил твой отзыв: +${r.reviewApproved} 🪙</li>
      </ul>
      <p class="text-muted" style="font-size:13px;margin:0;">Купленное применяется на странице твоей анкеты, в блоке «Оформление».</p>
    </div>

    ${sections}

    ${
      history
        ? `<div class="profile-block"><h3>Последние операции</h3><ul class="shop-hist">${history}</ul></div>`
        : ''
    }
  `;

  const daily = document.getElementById('daily-btn');
  if (daily) {
    daily.addEventListener('click', async () => {
      daily.disabled = true;
      try {
        const res = await api('/shop/daily', { method: 'POST', auth: true });
        if (typeof window.showToast === 'function') window.showToast(`+${res.added} монет!`);
        refreshCoinsInNav(res.coins);
        loadShop();
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
        loadShop();
      }
    });
  }

  root.querySelectorAll('[data-buy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      try {
        const res = await api('/shop/buy', { method: 'POST', auth: true, body: { itemId: btn.getAttribute('data-buy') } });
        if (typeof window.showToast === 'function') window.showToast('Куплено! Применить можно на странице своей анкеты.');
        refreshCoinsInNav(res.coins);
        loadShop();
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
        btn.disabled = false;
      }
    })
  );
}

// keeps the number in the menu in sync without a page reload
function refreshCoinsInNav(coins) {
  const u = getStoredUser();
  if (!u) return;
  u.coins = coins;
  setStoredUser(u);
  renderNav();
}

document.addEventListener('DOMContentLoaded', loadShop);
