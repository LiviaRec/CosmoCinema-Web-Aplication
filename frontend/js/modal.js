function injectAuthModal() {
    const modal = document.createElement('div');
    modal.id = 'auth-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal">
            <button class="modal-close" onclick="closeModal()">✕</button>
            <h2 id="modal-title">Sign In</h2>
            <div id="auth-error" class="error-msg"></div>

            <input type="text" id="auth-username" placeholder="Username" style="display:none">

            <input type="email" id="auth-email" placeholder="Email">
            <div id="email-hint" class="input-hint" style="display:none"></div>

            <div class="password-wrap">
                <input type="password" id="auth-password" placeholder="Password">
                <button type="button" class="eye-btn" onclick="togglePasswordVisibility()" title="Show/hide password">
                    <svg id="eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                        <circle cx="12" cy="12" r="3"/>
                    </svg>
                </button>
            </div>
            <div id="password-strength" style="display:none">
                <div class="strength-bar"><div class="strength-fill" id="strength-fill"></div></div>
                <span class="strength-label" id="strength-label"></span>
            </div>

            <button class="btn-auth" id="btn-auth" onclick="handleAuth()">Sign In</button>
            <div class="switch-auth" id="switch-auth">
                Don't have an account? <span onclick="switchModal()">Sign Up</span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    document.getElementById('auth-password').addEventListener('input', onPasswordInput);
    document.getElementById('auth-email').addEventListener('blur', validateEmailField);
}

// eye toggle
function togglePasswordVisibility() {
    const input = document.getElementById('auth-password');
    const icon  = document.getElementById('eye-icon');
    if (input.type === 'password') {
        input.type = 'text';
        // Crossed-out eye SVG
        icon.innerHTML = `
            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
            <line x1="1" y1="1" x2="23" y2="23"/>
        `;
    } else {
        input.type = 'password';
        icon.innerHTML = `
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        `;
    }
}

// email validation
function validateEmailField() {
    if (authMode !== 'signup') return;
    const email = document.getElementById('auth-email').value.trim();
    const hint  = document.getElementById('email-hint');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email) {
        hint.style.display = 'none';
        return;
    }

    if (!emailRegex.test(email)) {
        hint.textContent = 'Please enter a valid email address';
        hint.className = 'input-hint invalid';
        hint.style.display = 'block';
    } else {
        hint.textContent = 'Email is valid';
        hint.className = 'input-hint valid';
        hint.style.display = 'block';
    }
}

// password strength meter
function onPasswordInput() {
    if (authMode !== 'signup') return;
    const password = document.getElementById('auth-password').value;
    const strengthBar = document.getElementById('password-strength');
    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');

    if (!password) { strengthBar.style.display = 'none'; return; }
    strengthBar.style.display = 'block';

    const score = getPasswordScore(password);
    const levels = [
        { label: 'Very weak',  color: '#671a1a', width: '20%' },
        { label: 'Weak',       color: '#7d381f', width: '40%' },
        { label: 'Fair',       color: '#856f22', width: '60%' },
        { label: 'Strong',     color: '#217542', width: '80%' },
        { label: 'Very strong',color: '#206983', width: '100%' },
    ];
    const level = levels[Math.min(score, 4)];
    fill.style.width = level.width;
    fill.style.background = level.color;
    label.textContent = level.label;
    label.style.color = level.color;
}

function getPasswordScore(password) {
    let score = 0;
    if (password.length >= 8)  score++;
    if (password.length >= 12) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return Math.min(score, 4);
}

document.addEventListener('DOMContentLoaded', injectAuthModal);