document.getElementById('loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  const err = document.getElementById('err');
  const button = e.target.querySelector('button[type="submit"]');
  err.textContent = '';
  button.disabled = true;
  button.textContent = 'Signing in…';

  try {
    const r = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        username: e.target.username.value,
        password: e.target.password.value
      })
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Login failed');

    // Verify that the browser actually retained the session cookie before redirecting.
    const verify = await fetch('/api/auth/me', {
      credentials: 'same-origin',
      cache: 'no-store'
    });
    if (!verify.ok) {
      throw new Error('Login was accepted, but the session cookie was not retained. Check COOKIE_SECURE and make sure you are using HTTPS when COOKIE_SECURE=true.');
    }

    location.replace('/overview.html');
  } catch (x) {
    err.textContent = x.message || 'Login failed';
  } finally {
    button.disabled = false;
    button.textContent = 'Sign in';
  }
});
