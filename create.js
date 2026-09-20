function getVal(fd, key) {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

// Turns the chosen image file into a small JPEG data URL (max 256px side) so
// it can be stored together with the profile.
function fileToAvatarDataUrl(file, maxSize = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve(undefined);
    if (!/^image\//.test(file.type)) {
      return reject(new Error('Аватар должен быть картинкой (PNG, JPG или WebP).'));
    }
    if (file.size > 15 * 1024 * 1024) {
      return reject(new Error('Картинка слишком большая (максимум 15 МБ).'));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff'; // JPEG has no transparency
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);

      let quality = 0.85;
      let out = canvas.toDataURL('image/jpeg', quality);
      while (out.length > 45000 && quality > 0.4) {
        quality -= 0.1;
        out = canvas.toDataURL('image/jpeg', quality);
      }
      resolve(out);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось прочитать картинку. Попробуй другой файл.'));
    };
    img.src = url;
  });
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

    let avatarUrl;
    try {
      const fileInput = form.querySelector('input[name="avatarFile"]');
      avatarUrl = await fileToAvatarDataUrl(fileInput && fileInput.files[0]);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      return;
    }

    const fd = new FormData(form);
    const body = {
      name: getVal(fd, 'name'),
      avatarUrl,
      roles: selectedRoles,
      description: getVal(fd, 'description'),
      services: splitList(getVal(fd, 'services')),
      price: getVal(fd, 'price'),
      contact: getVal(fd, 'contact'),
      tags: splitList(getVal(fd, 'tags')),
      portfolio: [],
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
