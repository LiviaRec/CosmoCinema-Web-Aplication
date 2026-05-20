const API = 'http://localhost:3000/api';

// =================== AUTH STATE ===================
const auth = {
  token: localStorage.getItem('cosmo_token'),
  user: JSON.parse(localStorage.getItem('cosmo_user') || 'null'),

  setSession(token, user) {
    this.token = token;
    this.user = user;
    localStorage.setItem('cosmo_token', token);
    localStorage.setItem('cosmo_user', JSON.stringify(user));
  },

  clearSession() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('cosmo_token');
    localStorage.removeItem('cosmo_user');
  },

  isLoggedIn() { return !!this.token; }
};

// =================== API FETCH HELPER ===================
async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`;
  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// =================== STARFIELD ===================
function initStarfield() {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function createStars() {
    stars = [];
    for (let i = 0; i < 220; i++) {
      stars.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.8 + 0.2,
        op: Math.random() * 0.5 + 0.1,
        speed: Math.random() * 2000 + 1500,
        offset: Math.random() * Math.PI * 2
      });
    }
  }

  function draw(t) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      const opacity = s.op * (0.5 + 0.5 * Math.sin(t / s.speed + s.offset));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${opacity})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  resize();
  createStars();
  requestAnimationFrame(draw);
  window.addEventListener('resize', () => { resize(); createStars(); });
}

// =================== TOAST ===================
function showToast(msg) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('show'), 2500);
}

// =================== NAV AVATAR ===================
function updateNavAvatar() {
  document.querySelectorAll('.user-avatar').forEach(el => {
    if (auth.isLoggedIn()) {
      el.textContent = auth.user.username.charAt(0).toUpperCase();
      el.style.background = 'var(--purple)';
      el.title = auth.user.username;
      el.onclick = () => {
        auth.clearSession();
        window.location.href = '/index.html';
      };
    } else {
      el.textContent = '';
      el.style.background = '#ccc';
      el.title = 'Sign In';
      el.onclick = () => openModal('signin');
    }
  });
}

// =================== AUTH MODAL ===================
let authMode = 'signin';

function openModal(mode = 'signin') {
  authMode = mode;
  updateModalUI();
  document.getElementById('auth-modal').classList.add('visible');
}

function closeModal() {
  document.getElementById('auth-modal').classList.remove('visible');
  document.getElementById('auth-username') && (document.getElementById('auth-username').value = '');
  document.getElementById('auth-password').value = '';
  document.getElementById('auth-email') && (document.getElementById('auth-email').value = '');
  setAuthError('');
}

function switchModal() {
  authMode = authMode === 'signin' ? 'signup' : 'signin';
  updateModalUI();
}

function setAuthError(msg) {
  const el = document.getElementById('auth-error');
  if (el) el.textContent = msg;
}

function updateModalUI() {
  const title = document.getElementById('modal-title');
  const btn = document.getElementById('btn-auth');
  const sw = document.getElementById('switch-auth');
  const emailField = document.getElementById('auth-email');
  const usernameField = document.getElementById('auth-username');
  setAuthError('');

  if (authMode === 'signin') {
    title.textContent = 'Sign In';
    btn.textContent = 'Sign In';
    if (emailField) emailField.style.display = 'none';
    if (usernameField) usernameField.style.display = 'none';
    sw.innerHTML = `Don't have an account? <span onclick="switchModal()">Sign Up</span>`;
  } else {
    title.textContent = 'Sign Up';
    btn.textContent = 'Create Account';
    if (emailField) emailField.style.display = 'block';
    if (usernameField) usernameField.style.display = 'block';
    sw.innerHTML = `Already have an account? <span onclick="switchModal()">Sign In</span>`;
  }
}

async function handleAuth() {
  const email = document.getElementById('auth-email-login').value.trim();
  const password = document.getElementById('auth-password').value.trim();
  setAuthError('');

  try {
    if (authMode === 'signin') {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      auth.setSession(data.token, data.user);
    } else {
      const username = document.getElementById('auth-username').value.trim();
      const emailReg = document.getElementById('auth-email').value.trim();
      const data = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email: emailReg, password })
      });
      auth.setSession(data.token, data.user);
    }
    closeModal();
    updateNavAvatar();
    showToast(`Welcome, ${auth.user.username}!`);
  } catch (err) {
    setAuthError(err.message);
  }
}

// Close modal on overlay click
document.addEventListener('click', e => {
  if (e.target.id === 'auth-modal') closeModal();
});

// Init on every page
document.addEventListener('DOMContentLoaded', () => {
  initStarfield();
  updateNavAvatar();
});
