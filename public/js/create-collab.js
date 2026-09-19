document.addEventListener('DOMContentLoaded', async () => {
  const gate = document.getElementById('auth-gate');
  const formWrap = document.getElementById('form-wrap');
  const user = getStoredUser();

  if (!user || !getToken()) {
    gate.style.display = 'block';
    formWrap.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  formWrap.style.display = 'block';

  const tierFields = document.getElementById('gp-tier-fields');
  let gpTiers = [10, 25, 50, 75, 100];

  try {
    const { gpTiers: fetched } = await api('/collab-tiers');
    if (fetched && fetched.length) gpTiers = fetched;
  } catch (err) {
    // fall back to the default tier list above
  }

  tierFields.innerHTML = gpTiers
    .map(
      (pct) => `
      <div class="field-row" style="margin-bottom:10px;">
        <div class="field" style="margin-bottom:0;"><label>${pct}%</label></div>
        <div class="field" style="margin-bottom:0;">
          <input type="number" min="0" step="1" name="tier_${pct}" placeholder="цена ₽ (пусто = недоступно)" />
        </div>
      </div>
    `
    )
    .join('');

  const form = document.getElementById('collab-form');
  const msg = document.getElementById('collab-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';

    const fd = new FormData(form);
    const tiers = gpTiers
      .map((pct) => ({ tierPercent: pct, price: fd.get(`tier_${pct}`) }))
      .filter((t) => t.price !== null && t.price !== '');

    if (!tiers.length) {
      msg.className = 'form-msg error';
      msg.textContent = 'Укажи цену хотя бы для одной стадии.';
      return;
    }

    const body = {
      title: fd.get('title').trim(),
      description: fd.get('description').trim(),
      gpTiers: tiers,
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      const { collab } = await api('/collabs', { method: 'POST', auth: true, body });
      msg.className = 'form-msg success';
      msg.textContent = 'Коллаб опубликован!';
      setTimeout(() => {
        window.location.href = `/collab.html?id=${collab.id}`;
      }, 700);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      submitBtn.disabled = false;
    }
  });
});
