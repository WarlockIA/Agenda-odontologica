document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const nameInput = document.getElementById('name');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const roleInput = document.getElementById('role');
  
  const togglePasswordBtn = document.getElementById('toggle-password');
  const eyeIcon = document.getElementById('eye-icon');
  
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const spinner = btnSubmit.querySelector('.spinner');
  
  const registerAlert = document.getElementById('register-alert');
  const alertText = document.getElementById('alert-text');
  const loginCard = document.querySelector('.login-card');

  // ============================================================
  // Mostrar/Ocultar Contraseña
  // ============================================================
  togglePasswordBtn?.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

    if (isPassword) {
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
      togglePasswordBtn.setAttribute('aria-label', 'Ocultar contraseña');
    } else {
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
      togglePasswordBtn.setAttribute('aria-label', 'Mostrar contraseña');
    }
  });

  // Limpieza de errores al escribir
  nameInput?.addEventListener('input', () => clearError('name'));
  emailInput?.addEventListener('input', () => clearError('email'));
  passwordInput?.addEventListener('input', () => clearError('password'));
  roleInput?.addEventListener('change', () => clearError('role'));

  // ============================================================
  // Envío Asíncrono de Formulario
  // ============================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    const role = roleInput.value;

    // Validación del cliente
    let isValid = true;
    
    if (!name || name.length < 3) {
      showError('name', 'Ingrese un nombre válido (mínimo 3 caracteres).');
      isValid = false;
    }
    
    if (!email) {
      showError('email', 'El correo electrónico es obligatorio.');
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('email', 'Ingrese un formato de correo válido.');
        isValid = false;
      }
    }

    if (!password || password.length < 6) {
      showError('password', 'La contraseña debe tener al menos 6 caracteres.');
      isValid = false;
    }
    
    if (!role) {
      showError('role', 'Debe seleccionar un rol / cargo.');
      isValid = false;
    }

    if (!isValid) return;

    setLoading(true);

    const apiCall = fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role })
    });

    const delay = new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const [response] = await Promise.all([apiCall, delay]);
      const data = await response.json();

      if (!response.ok) {
        // Error desde el backend (ej: correo duplicado)
        showToast(data.error || 'No se pudo crear la cuenta', 'error');
        triggerShake();
        setLoading(false);
        return;
      }

      // Registro exitoso
      showToast('Perfil creado con éxito. Redirigiendo...', 'success');
      
      setTimeout(() => {
        window.location.href = 'index.html'; // Redirigir a login después de crear
      }, 1500);

    } catch (err) {
      console.error('Error al registrar usuario:', err);
      showToast('Error de conexión con el servidor.', 'error');
      triggerShake();
      setLoading(false);
    }
  });

  // Funciones Auxiliares
  function showError(fieldId, message) {
    const errorSpan = document.getElementById(`${fieldId}-error`);
    const inputElement = document.getElementById(fieldId);
    if (errorSpan) errorSpan.textContent = message;
    if (inputElement) inputElement.style.borderColor = 'var(--danger)';
  }

  function clearError(fieldId) {
    const errorSpan = document.getElementById(`${fieldId}-error`);
    const inputElement = document.getElementById(fieldId);
    if (errorSpan) errorSpan.textContent = '';
    if (inputElement) inputElement.style.borderColor = '';
  }

  function hideAlert() {
    registerAlert.classList.remove('show');
    setTimeout(() => {
      if (!registerAlert.classList.contains('show')) {
        registerAlert.setAttribute('hidden', '');
      }
    }, 400);
  }

  function triggerShake() {
    loginCard.classList.add('shake-animation');
    setTimeout(() => {
      loginCard.classList.remove('shake-animation');
    }, 400);
  }

  function setLoading(isLoading) {
    if (isLoading) {
      btnSubmit.disabled = true;
      btnSubmit.classList.add('loading');
      if(btnText) btnText.setAttribute('hidden', '');
      if(spinner) spinner.removeAttribute('hidden');
    } else {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('loading');
      if(btnText) btnText.removeAttribute('hidden');
      setTimeout(() => {
        if (!btnSubmit.classList.contains('loading')) {
          if(spinner) spinner.setAttribute('hidden', '');
        }
      }, 300);
    }
  }
});
