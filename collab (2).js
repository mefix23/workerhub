let currentCollab = null;

function tierButtonsHtml(tiers, kind) {
  return tiers
    .map(
      (t) => `
      <button class="tier-btn" data-tier="${t.tier_percent}" ${t.is_available ? '' : 'disabled'}>
        <span class="tier-pct">${t.tier_percent}%</span>
        <span class="tier-price">${formatPrice(t.price_cents)}</span>
      </button>
    `
    )
    .join('');
}

async function loadCollab() {
  const root = document.getElementById('collab-root');
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    root.innerHTML = `<div class="empty-state">Коллаб не найден.</div>`;
    return;
  }

  try {
    const { collab } = await api(`/collabs/${id}`);
    currentCollab = collab;
    document.title = `${collab.title} — WORKERHUB`;

    const user = getStoredUser();
    const isCreator = user && user.id === collab.creator_id;
    const isDecorator = user && user.id === collab.decorator_id;
    const totalPercent = 100 + collab.deco_percent;
    const displayPercent = collab.deco_percent > 0 ? totalPercent : collab.gp_percent;

    root.innerHTML = `
      <div class="profile-header" style="padding-top:0;">
        <div>
          <h1 class="profile-name">${escapeHtml(collab.title)}</h1>
          <span class="status-pill">${escapeHtml(collabStatusLabel(collab.status))}</span>
        </div>
      </div>

      <div class="profile-body">
        <div>
          <div class="profile-block">
            <h3>Описание</h3>
            <p>${escapeHtml(collab.description)}</p>
          </div>

          <div class="profile-block">
            <h3>Прогресс — ${displayPercent}%</h3>
            <div class="progress-track">
              <div class="progress-track-fill" data-target="${Math.min(displayPercent, 100)}"></div>
            </div>
            <div class="progress-stages" id="progress-stages"></div>
          </div>

          <div class="profile-block">
            <h3>GP — стадии</h3>
            <div class="tier-grid" id="gp-tiers">${tierButtonsHtml(collab.gp_tiers, 'gp')}</div>
          </div>

          ${
            collab.deco_tiers.length
              ? `<div class="profile-block">
                   <h3>Deco — стадии (поверх 100% GP)</h3>
                   <div class="tier-grid" id="deco-tiers">${tierButtonsHtml(collab.deco_tiers, 'deco')}</div>
                 </div>`
              : ''
          }

          ${
            collab.gp_percent >= 100 && !collab.decorator_id && user && !isCreator
              ? `<div class="profile-block" id="deco-attach-block">
                   <h3>Стать декоратором</h3>
                   <p class="text-muted" style="font-size:13px;">GP готов на 100%. Укажи цены за стадии деко (125–200%), чтобы начать продавать декор.</p>
                   <div class="field-row"><div class="field"><label>125%</label><input type="number" min="0" id="deco-125" placeholder="₽" /></div>
                   <div class="field"><label>150%</label><input type="number" min="0" id="deco-150" placeholder="₽" /></div></div>
                   <div class="field-row"><div class="field"><label>175%</label><input type="number" min="0" id="deco-175" placeholder="₽" /></div>
                   <div class="field"><label>200%</label><input type="number" min="0" id="deco-200" placeholder="₽" /></div></div>
                   <button class="btn btn-primary" id="attach-deco-btn">Добавить деко-тарифы</button>
                   <div id="deco-msg" class="form-msg"></div>
                 </div>`
              : ''
          }
        </div>

        <div>
          <div class="sidebar-card">
            <p class="text-muted" style="margin-top:0;font-size:13px;">Купи доступ к нужной стадии — покупка фиксируется как право на эту стадию коллаба.</p>
            <div id="purchase-msg" class="form-msg"></div>
          </div>
        </div>
      </div>
    `;

    document.querySelectorAll('.tier-btn:not(:disabled)').forEach((btn) => {
      btn.addEventListener('click', () => purchaseTier(Number(btn.dataset.tier)));
    });

    // Animated progress stages (10→200)
    const stagesEl = document.getElementById('progress-stages');
    if (stagesEl) {
      const stages = [10, 25, 50, 75, 100, 125, 150, 175, 200];
      const current = displayPercent;
      stagesEl.innerHTML = stages.map((s) => {
        let cls = 'progress-stage';
        if (current >= s) cls += ' completed';
        if (current === s || (s === 100 && current >= 100 && current < 125) || (current > 100 && s === Math.min(...stages.filter(x => x >= current)))) cls += ' active';
        // simpler active logic
        return `<div class="${cls}"><div class="progress-stage-dot"></div><span class="progress-stage-label">${s}%</span></div>`;
      }).join('');
      // fix active: mark the highest completed as active
      const dots = stagesEl.querySelectorAll('.progress-stage');
      let lastCompleted = -1;
      stages.forEach((s, i) => { if (current >= s) lastCompleted = i; });
      dots.forEach((d) => d.classList.remove('active'));
      if (lastCompleted >= 0) dots[lastCompleted].classList.add('active');
    }

    if (typeof animateProgress === 'function') animateProgress();

    const attachBtn = document.getElementById('attach-deco-btn');
    if (attachBtn) attachBtn.addEventListener('click', attachDeco);
  } catch (err) {
    root.innerHTML = `<div class="empty-state">Не удалось загрузить коллаб: ${escapeHtml(err.message)}</div>`;
  }
}

async function purchaseTier(tierPercent) {
  const msg = document.getElementById('purchase-msg');
  if (!getToken()) {
    msg.className = 'form-msg error';
    msg.textContent = 'Сначала войди в аккаунт.';
    return;
  }
  try {
    await api(`/collabs/${currentCollab.id}/purchase`, {
      method: 'POST',
      auth: true,
      body: { tierPercent },
    });
    msg.className = 'form-msg success';
    msg.textContent = `Доступ к стадии ${tierPercent}% куплен!`;
    loadCollab();
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  }
}

async function attachDeco() {
  const msg = document.getElementById('deco-msg');
  const decoTiers = [125, 150, 175, 200]
    .map((pct) => ({ tierPercent: pct, price: document.getElementById(`deco-${pct}`).value }))
    .filter((t) => t.price !== '' && t.price !== null);

  if (!decoTiers.length) {
    msg.className = 'form-msg error';
    msg.textContent = 'Укажи цену хотя бы для одной деко-стадии.';
    return;
  }

  try {
    await api(`/collabs/${currentCollab.id}/deco`, {
      method: 'POST',
      auth: true,
      body: { decoTiers },
    });
    msg.className = 'form-msg success';
    msg.textContent = 'Деко-тарифы добавлены!';
    loadCollab();
  } catch (err) {
    msg.className = 'form-msg error';
    msg.textContent = err.message;
  }
}

document.addEventListener('DOMContentLoaded', loadCollab);
