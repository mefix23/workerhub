function splitList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

async function loadRoleCheckboxes() {
  const container = document.getElementById('role-checkboxes');
  if (!container) return;

  try {
    const { roles } = await api('/roles');
    container.innerHTML = roles
      .map(
        (r) => `
        <label class="role-check">
          <input type="checkbox" name="roles" value="${escapeHtml(r.slug)}" />
          <span>${escapeHtml(r.label)}</span>
        </label>
      `
      )
      .join('');
  } catch (err) {
    container.innerHTML = `<p class="text-muted" style="font-size:13px;">Не удалось загрузить список ролей. Обнови страницу.</p>`;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const gate = document.getElementById('auth-gate');
  const formWrap = document.getElementById('create-form-wrap');
  const user = getStoredUser();

  if (!user || !getToken()) {
    gate.style.display = 'block';
    formWrap.style.display = 'none';
    return;
  }
  gate.style.display = 'none';
  formWrap.style.display = 'block';

  loadRoleCheckboxes();

  const form = document.getElementById('create-form');
  const msg = document.getElementById('create-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '';

    const selectedRoles = Array.from(
      form.querySelectorAll('input[name="roles"]:checked')
    ).map((el) => el.value);

    if (!selectedRoles.length) {
      msg.className = 'form-msg error';
      msg.textContent = 'Выбери хотя бы одну роль.';
      return;
    }

    const fd = new FormData(form);
    const body = {
      name: fd.get('name').trim(),
      avatarUrl: fd.get('avatarUrl').trim() || undefined,
      roles: selectedRoles,
      description: fd.get('description').trim(),
      services: splitList(fd.get('services') || ''),
      price: fd.get('price'),
      contact: fd.get('contact').trim(),
      tags: splitList(fd.get('tags') || ''),
      portfolio: splitList(fd.get('portfolio') || ''),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    try {
      const { profile } = await api('/profiles', { method: 'POST', auth: true, body });
      msg.className = 'form-msg success';
      msg.textContent = 'Анкета создана и опубликована!';
      setTimeout(() => {
        window.location.href = `/profile.html?id=${profile.id}`;
      }, 700);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });
});
