// Adds a "Показать / Скрыть" button to every password field so people can
// check what they typed.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[type="password"]').forEach((input) => {
    const wrap = document.createElement('div');
    wrap.style.position = 'relative';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    input.style.paddingRight = '92px';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Показать';
    btn.setAttribute('aria-label', 'Показать или скрыть пароль');
    btn.style.cssText =
      'position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;' +
      'color:var(--accent-hover);font-size:13px;font-weight:600;cursor:pointer;padding:6px 4px;';
    btn.addEventListener('click', () => {
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.textContent = show ? 'Скрыть' : 'Показать';
    });
    wrap.appendChild(btn);
  });
});
