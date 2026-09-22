let works = [];
let offset = 0;
let loading = false;
let done = false;
let activeWorkId = null;
let observer = null;

function youtubeId(url) {
  if (!url) return null;
  try {
    const u = new URL(url, location.origin);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = u.pathname.split('/').filter(Boolean)[0];
      return id && /^[\w-]{6,}$/.test(id) ? id : null;
    }
    if (host.includes('youtube')) {
      if (u.pathname.startsWith('/embed/') || u.pathname.startsWith('/shorts/')) {
        const id = u.pathname.split('/')[2];
        return id && /^[\w-]{6,}$/.test(id) ? id : null;
      }
      const v = u.searchParams.get('v');
      return v && /^[\w-]{6,}$/.test(v) ? v : null;
    }
  } catch (e) {}
  return null;
}

function mediaHtml(w) {
  const yt = youtubeId(w.video_url);
  if (yt) {
    return `<iframe class="feed-iframe" data-yt="1" src="https://www.youtube.com/embed/${escapeHtml(yt)}?enablejsapi=1&playsinline=1&rel=0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  }
  return `<video class="feed-video" playsinline loop muted preload="metadata" src="${escapeHtml(w.video_url)}"></video>`;
}

function itemHtml(w) {
  return `
    <div class="feed-item" data-id="${w.id}">
      ${mediaHtml(w)}
      <div class="feed-side">
        <button class="feed-action${w.liked_by_me ? ' liked' : ''}" data-like="${w.id}" title="Лайк">
          ${w.liked_by_me ? '♥' : '♡'}
          <span data-likes="${w.id}">${w.likes_count || 0}</span>
        </button>
        <button class="feed-action" data-comments="${w.id}" title="Комментарии">
          💬
          <span data-cc="${w.id}">${w.comments_count || 0}</span>
        </button>
      </div>
      <div class="feed-meta">
        <div class="feed-author">
          <a href="/user.html?id=${w.user_id}">@${escapeHtml(w.author_name || 'user')}</a>
        </div>
        <div class="feed-caption">${escapeHtml(w.caption || '')}</div>
      </div>
    </div>
  `;
}

function bindItem(el) {
  const id = Number(el.getAttribute('data-id'));
  const likeBtn = el.querySelector('[data-like]');
  if (likeBtn) {
    likeBtn.addEventListener('click', async () => {
      if (!getToken()) {
        window.location.href = '/login.html';
        return;
      }
      likeBtn.disabled = true;
      try {
        const { work, liked } = await api(`/works/${id}/like`, { method: 'POST', auth: true });
        likeBtn.classList.toggle('liked', liked);
        likeBtn.innerHTML = `${liked ? '♥' : '♡'}<span data-likes="${id}">${work.likes_count}</span>`;
        const w = works.find((x) => x.id === id);
        if (w) {
          w.liked_by_me = liked;
          w.likes_count = work.likes_count;
        }
      } catch (err) {
        if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
      } finally {
        likeBtn.disabled = false;
      }
    });
  }
  const cmtBtn = el.querySelector('[data-comments]');
  if (cmtBtn) cmtBtn.addEventListener('click', () => openComments(id));
}

function setupObserver() {
  if (observer) observer.disconnect();
  observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        const video = entry.target.querySelector('video.feed-video');
        if (!video) return;
        if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
          video.muted = true;
          video.play().catch(() => {});
        } else {
          video.pause();
        }
      });
    },
    { root: document.getElementById('feed-track'), threshold: [0.6] }
  );
  document.querySelectorAll('.feed-item').forEach((el) => observer.observe(el));
}

async function loadMore() {
  if (loading || done) return;
  loading = true;
  try {
    const data = await api(`/works?limit=10&offset=${offset}`, { auth: !!getToken() });
    const list = data.works || [];
    if (!list.length) {
      done = true;
      if (!works.length) {
        document.getElementById('feed-track').innerHTML = `
          <div class="feed-empty">
            <div style="font-size:40px;">🎬</div>
            <div>Пока нет видео</div>
            <a class="btn btn-primary" href="/user.html">Выложить первое</a>
          </div>`;
      }
      return;
    }
    const track = document.getElementById('feed-track');
    if (!works.length) track.innerHTML = '';
    list.forEach((w) => {
      works.push(w);
      track.insertAdjacentHTML('beforeend', itemHtml(w));
      const el = track.lastElementChild;
      bindItem(el);
    });
    offset += list.length;
    if (list.length < 10) done = true;
    setupObserver();
  } catch (err) {
    if (!works.length) {
      document.getElementById('feed-track').innerHTML = `
        <div class="feed-empty">Не удалось загрузить ленту: ${escapeHtml(err.message)}</div>`;
    }
  } finally {
    loading = false;
  }
}

function openComments(workId) {
  activeWorkId = workId;
  document.getElementById('cmt-backdrop').classList.add('open');
  document.getElementById('cmt-sheet').classList.add('open');
  loadComments(workId);
}

function closeComments() {
  document.getElementById('cmt-backdrop').classList.remove('open');
  document.getElementById('cmt-sheet').classList.remove('open');
  activeWorkId = null;
}

async function loadComments(workId) {
  const box = document.getElementById('cmt-list');
  box.innerHTML = '<div class="text-muted">Загрузка…</div>';
  try {
    const { comments } = await api(`/works/${workId}/comments`, { auth: !!getToken() });
    if (!comments.length) {
      box.innerHTML = '<div class="text-muted">Пока нет комментариев. Будь первым.</div>';
      return;
    }
    box.innerHTML = comments
      .map(
        (c) => `
      <div class="cmt">
        <span class="cmt-name">${escapeHtml(c.author_name)}</span>
        <span class="cmt-time">${escapeHtml(String(c.created_at).slice(0, 16))}</span>
        <div>${escapeHtml(c.body)}</div>
      </div>`
      )
      .join('');
  } catch (err) {
    box.innerHTML = `<div class="text-muted">${escapeHtml(err.message)}</div>`;
  }
}

async function sendComment() {
  if (!activeWorkId) return;
  if (!getToken()) {
    window.location.href = '/login.html';
    return;
  }
  const input = document.getElementById('cmt-input');
  const body = (input.value || '').trim();
  if (!body) return;
  const btn = document.getElementById('cmt-send');
  btn.disabled = true;
  try {
    const res = await api(`/works/${activeWorkId}/comments`, {
      method: 'POST',
      auth: true,
      body: { body },
    });
    input.value = '';
    loadComments(activeWorkId);
    const span = document.querySelector(`[data-cc="${activeWorkId}"]`);
    if (span && res.comments_count != null) span.textContent = res.comments_count;
    const w = works.find((x) => x.id === activeWorkId);
    if (w) w.comments_count = res.comments_count;
  } catch (err) {
    if (typeof window.showToast === 'function') window.showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const track = document.getElementById('feed-track');
  track.addEventListener('scroll', () => {
    if (track.scrollTop + track.clientHeight > track.scrollHeight - 200) loadMore();
  });
  document.getElementById('cmt-close').addEventListener('click', closeComments);
  document.getElementById('cmt-backdrop').addEventListener('click', closeComments);
  document.getElementById('cmt-send').addEventListener('click', sendComment);
  document.getElementById('cmt-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      sendComment();
    }
  });
  loadMore();
});
