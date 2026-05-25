// auth modal for sign in and sign up, injected on page
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
      <input type="password" id="auth-password" placeholder="Password">
      <button class="btn-auth" id="btn-auth" onclick="handleAuth()">Sign In</button>
      <div class="switch-auth" id="switch-auth">
        Don't have an account? <span onclick="switchModal()">Sign Up</span>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

document.addEventListener('DOMContentLoaded', injectAuthModal);