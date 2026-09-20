/* Shared UI helpers — nav scroll, reveal, reduced motion */

(function () {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Navbar scroll state
  function initNavScroll() {
    const nav = document.querySelector('.nav');
    if (!nav) return;

    const onScroll = () => {
      if (window.scrollY > 12) nav.classList.add('scrolled');
      else nav.classList.remove('scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  // Scroll reveal for elements with .reveal
  function initReveal() {
    if (prefersReduced) {
      document.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );
    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  // Animate progress bars when they appear
  function initProgressBars() {
    document.querySelectorAll('.progress-bar-fill[data-target]').forEach((el) => {
      const target = el.getAttribute('data-target');
      requestAnimationFrame(() => {
        el.style.width = target + '%';
      });
    });
    document.querySelectorAll('.progress-track-fill[data-target]').forEach((el) => {
      const target = el.getAttribute('data-target');
      requestAnimationFrame(() => {
        el.style.width = Math.min(Number(target), 100) + '%';
      });
    });
  }

  // Simple toast
  window.showToast = function (message, type = 'success') {
    let container = document.querySelector('.toast-container');
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(8px)';
      toast.style.transition = '0.3s';
      setTimeout(() => toast.remove(), 300);
    }, 3200);
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Wait a tick so nav.js can render the nav first
    setTimeout(() => {
      initNavScroll();
      initReveal();
      initProgressBars();
    }, 30);
  });

  // Re-run progress animation after dynamic content
  window.animateProgress = initProgressBars;
})();
