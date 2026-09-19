function splitList(value) {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
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

  const form = document.getElementById('create-form');
  const msg = document.getElementById('create-msg');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.className = 'form-msg';
    msg.textContent = '';

    const fd = new FormData(form);
    const body = {
      name: fd.get('name').trim(),
      avatarUrl: fd.get('avatarUrl').trim() || undefined,
      roleTitle: fd.get('roleTitle').trim(),
      description: fd.get('description').trim(),
      services: splitList(fd.get('services') || ''),
      price: fd.get('price'),
      contact: fd.get('contact').trim(),
      tags: splitList(fd.get('tags') || ''),
      portfolio: splitList(fd.get('portfolio') || ''),
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

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
    }
  });
});
