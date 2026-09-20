document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const registerForm = document.getElementById('register-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('auth-msg');
      msg.className = 'form-msg';
      const fd = new FormData(loginForm);

      const btn = loginForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.classList.add('loading');
      try {
        const { user, token } = await api('/auth/login', {
          method: 'POST',
          body: { email: fd.get('email').trim(), password: fd.get('password') },
        });
        setToken(token);
        setStoredUser(user);
        window.location.href = '/catalog.html';
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err.message;
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('auth-msg');
      msg.className = 'form-msg';
      const fd = new FormData(registerForm);

      const btn = registerForm.querySelector('button[type="submit"]');
      btn.disabled = true;
      btn.classList.add('loading');
      try {
        const { user, token } = await api('/auth/register', {
          method: 'POST',
          body: {
            username: fd.get('username').trim(),
            email: fd.get('email').trim(),
            password: fd.get('password'),
          },
        });
        setToken(token);
        setStoredUser(user);
        window.location.href = '/create.html';
      } catch (err) {
        msg.className = 'form-msg error';
        msg.textContent = err.message;
        btn.disabled = false;
        btn.classList.remove('loading');
      }
    });
  }
});
