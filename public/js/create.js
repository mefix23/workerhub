function getVal(fd, key) {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

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
      name: getVal(fd, 'name'),
      avatarUrl: getVal(fd, 'avatarUrl') || undefined,
      roles: selectedRoles,
      description: getVal(fd, 'description'),
      services: splitList(getVal(fd, 'services')),
      price: getVal(fd, 'price'),
      contact: getVal(fd, 'contact'),
      tags: splitList(getVal(fd, 'tags')),
      portfolio: splitList(getVal(fd, 'portfolio')),
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
