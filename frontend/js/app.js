window.API_URL = '/api'; //deployment override


// manage auth over all pages
//localstorage used to save dta over over refrech page
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
    // check if user is logged in for fav, list pges
    isLoggedIn() { return !!this.token; }
};

// wrapper for fetch to handle auth and errors in one place
async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth.token) headers['Authorization'] = `Bearer ${auth.token}`; //standard format for JWT authentication
    const res = await fetch(`${window.API_URL}${path}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
}

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


// for user avatar , future imprememntaion , throw error still
function updateNavAvatar() {
    document.querySelectorAll('.user-avatar').forEach(el => {
        if (auth.isLoggedIn()) {
            el.textContent = auth.user.username.charAt(0).toUpperCase();
            el.style.background = '#5415b4';
            el.title = auth.user.username;
            el.onclick = () => {
                auth.clearSession();
                window.location.href = 'index.html';
            };
        } else {
            el.textContent = '';
            el.style.background = '#ccc';
            el.title = 'Sign In';
            el.onclick = () => openModal('signin');
        }
    });
    updateNavSignin();
}

function updateNavSignin() {
    const link = document.getElementById('nav-signin');
    if (!link) return;
    if (auth.isLoggedIn()) {
        link.textContent = auth.user.username;
    } else {
        link.textContent = 'Sign In';
    }
}

let authMode = 'signin';

function openModal(mode = 'signin') {
    authMode = mode;
    updateModalUI();
    document.getElementById('auth-modal').classList.add('visible');
}

function closeModal() {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.classList.remove('visible');
    const u = document.getElementById('auth-username');
    const e = document.getElementById('auth-email');
    const p = document.getElementById('auth-password');
    if (u) u.value = '';
    if (e) e.value = '';
    if (p) p.value = '';
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
    const usernameField = document.getElementById('auth-username');
    if (!title || !btn || !sw) return;
    setAuthError('');

    if (authMode === 'signin') {
        title.textContent = 'Sign In';
        btn.textContent = 'Sign In';
        if (usernameField) usernameField.style.display = 'none';
        sw.innerHTML = `Don't have an account? <span onclick="switchModal()">Sign Up</span>`;
    } else {
        title.textContent = 'Sign Up';
        btn.textContent = 'Create Account';
        if (usernameField) usernameField.style.display = 'block';
        sw.innerHTML = `Already have an account? <span onclick="switchModal()">Sign In</span>`;
    }
}

// handle both sign in and sign up with same function
async function handleAuth() {
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value.trim();
    setAuthError('');

    if (!email || !password) {
        setAuthError('Please fill in all fields.');
        return;
    }

     //validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        setAuthError('Please enter a valid email address.');
        return;
    }

    try {
        if (authMode === 'signin') {
            const data = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });
            auth.setSession(data.token, data.user);
        } else {
            const username = document.getElementById('auth-username').value.trim();
            if (!username) { setAuthError('Username is required.'); return; }
 
            if (password.length < 6) {
                setAuthError('Password must be at least 6 characters.');
                return;
            }
 
            const data = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, email, password })
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

document.addEventListener('click', e => {
    if (e.target.id === 'auth-modal') closeModal();
});

document.addEventListener('DOMContentLoaded', () => {
    updateNavAvatar();
});