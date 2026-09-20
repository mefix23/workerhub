function getVal(fd, key) {
  const v = fd.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

// Turns a chosen image file into a JPEG data URL that fits into `maxChars`
// (shrinks the picture and lowers the quality until it does).
function fileToDataUrl(file, maxSize, maxChars) {
  return new Promise((resolve, reject) => {
    if (!file || !file.size) return resolve(undefined);
    if (!/^image\//.test(file.type)) {
      return reject(new Error('Нужна картинка (PNG, JPG или WebP).'));
    }
    if (file.size > 25 * 1024 * 1024) {
      return reject(new Error('Картинка слишком большая (максимум 25 МБ).'));
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      let quality = 0.85;
      let out = '';

      for (let i = 0; i < 40; i += 1) {
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff'; // JPEG has no transparency
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        out = canvas.toDataURL('image/jpeg', quality);
        if (out.length <= maxChars) break;
        quality -= 0.1;
        if (quality < 0.45) {
          quality = 0.75;
          scale *= 0.75;
        }
      }
      if (out.length > maxChars) {
        reject(new Error('Не получилось уменьшить картинку. Попробуй другую.'));
        return;
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

// Avatar: small square-ish picture.
const fileToAvatarDataUrl = (file) => fileToDataUrl(file, 256, 45000);

// Works gallery: up to 5 photos (uploaded) and/or video links (one per line).
async function collectMedia(form, kept = []) {
  const files = Array.from(form.querySelector('input[name="worksFiles"]').files || []);
  const links = getVal(new FormData(form), 'videoLinks')
    .split(/\s+/)
    .map((l) => l.trim())
    .filter(Boolean);

  const total = kept.length + files.length + links.length;
  if (total < 1 || total > 5) {
    throw new Error('Добавь от 1 до 5 фото или ссылок на видео с твоими работами.');
  }
  for (const l of links) {
    if (!/^https?:\/\/\S+$/.test(l) || l.length > 300) {
      throw new Error('Ссылка на видео должна начинаться с http:// или https://');
    }
  }

  const media = [...kept];
  for (const f of files) {
    const url = await fileToDataUrl(f, 1280, 230000);
    if (url) media.push({ type: 'image', url });
  }
  for (const l of links) media.push({ type: 'video', url: l });
  return media;
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

// Small preview of the works that are already saved (edit mode) with a
// "remove" button on each.
function renderExistingMedia(kept, onChange) {
  const box = document.getElementById('existing-media');
  box.innerHTML = kept
    .map((m, i) => {
      const inner =
        m.type === 'image'
          ? `<img src="${escapeHtml(m.url)}" alt="" style="width:72px;height:72px;object-fit:cover;border-radius:8px;display:block;" />`
          : `<div style="width:72px;height:72px;border-radius:8px;border:1px solid var(--border-strong);display:flex;align-items:center;justify-content:center;font-size:12px;">▶ видео</div>`;
      return `<div style="position:relative;">${inner}<button type="button" data-remove="${i}" aria-label="Убрать" style="position:absolute;top:-6px;right:-6px;width:22px;height:22px;border-radius:50%;border:none;background:#ef4444;color:#fff;cursor:pointer;line-height:1;">×</button></div>`;
    })
    .join('');
  box.querySelectorAll('button[data-remove]').forEach((b) =>
    b.addEventListener('click', () => {
      kept.splice(parseInt(b.getAttribute('data-remove'), 10), 1);
      renderExistingMedia(kept, onChange);
      if (onChange) onChange();
    })
  );
}

document.addEventListener('DOMContentLoaded', async () => {
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

  await loadRoleCheckboxes();

  const form = document.getElementById('create-form');
  const msg = document.getElementById('create-msg');
  const worksInput = form.querySelector('input[name="worksFiles"]');
  worksInput.addEventListener('change', () => {
    const n = worksInput.files.length;
    document.getElementById('works-count').textContent = n ? `Выбрано фото: ${n}` : '';
  });

  // ----- edit mode: /create.html?edit=ID -----
  const editId = new URLSearchParams(window.location.search).get('edit');
  let editing = null; // { id, avatarUrl }
  let kept = []; // already saved works that stay in the profile

  if (editId) {
    document.getElementById('form-title').textContent = 'Изменить анкету';
    document.getElementById('form-sub').textContent =
      'После сохранения анкета снова уйдёт на проверку модератору и не будет видна в каталоге, пока её не одобрят.';
    form.querySelector('button[type="submit"]').textContent = 'Сохранить и отправить на модерацию';
    document.getElementById('avatar-hint').textContent = 'оставь пустым, чтобы не менять';

    try {
      const { profile: p } = await api(`/profiles/${encodeURIComponent(editId)}`, { auth: true });
      if (p.user_id !== user.id) throw new Error('Это не твоя анкета.');

      editing = { id: p.id, avatarUrl: p.avatar_url || undefined };
      form.querySelector('input[name="name"]').value = p.name || '';
      form.querySelector('input[name="title"]').value = p.title || '';
      form.querySelector('textarea[name="description"]').value = p.description || '';
      form.querySelector('textarea[name="servicesText"]').value = p.services_text || '';
      form.querySelector('input[name="contact"]').value = p.contact || '';
      form.querySelector('input[name="tags"]').value = (p.tags || []).join(', ');
      const price = form.querySelector('input[name="price"]');
      const rub = p.price_cents / 100;
      if (!Number.isInteger(rub)) price.step = 'any';
      price.value = rub;
      (p.roles || []).forEach((slug) => {
        const box = form.querySelector(`input[name="roles"][value="${slug}"]`);
        if (box) box.checked = true;
      });
      kept = Array.isArray(p.media) ? p.media.slice() : [];
      renderExistingMedia(kept);
    } catch (err) {
      form.style.display = 'none';
      formWrap.insertAdjacentHTML(
        'beforeend',
        `<div class="empty-state">Не удалось открыть анкету для изменения: ${escapeHtml(err.message)}</div>`
      );
      return;
    }
  }

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
    // no new picture chosen while editing -> keep the current avatar
    if (!avatarUrl && editing) avatarUrl = editing.avatarUrl;

    let media;
    try {
      media = await collectMedia(form, kept);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      return;
    }

    const fd = new FormData(form);
    const body = {
      name: getVal(fd, 'name'),
      title: getVal(fd, 'title'),
      avatarUrl,
      roles: selectedRoles,
      description: getVal(fd, 'description'),
      servicesText: getVal(fd, 'servicesText'),
      media,
      services: [],
      price: getVal(fd, 'price'),
      contact: getVal(fd, 'contact'),
      tags: splitList(getVal(fd, 'tags')),
      portfolio: [],
    };

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');

    try {
      if (editing) {
        await api(`/profiles/${editing.id}`, { method: 'PUT', auth: true, body });
        msg.className = 'form-msg success';
        msg.textContent = 'Изменения сохранены. Анкета отправлена на повторную проверку.';
      } else {
        await api('/profiles', { method: 'POST', auth: true, body });
        msg.className = 'form-msg success';
        msg.textContent = 'Анкета отправлена на модерацию! Она появится в каталоге после проверки.';
      }
      setTimeout(() => {
        window.location.href = '/user.html';
      }, 1500);
    } catch (err) {
      msg.className = 'form-msg error';
      msg.textContent = err.message;
      submitBtn.disabled = false;
      submitBtn.classList.remove('loading');
    }
  });
});
