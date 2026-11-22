document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const eyeIcon = document.getElementById('eye-icon');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const spinner = btnSubmit.querySelector('.spinner');

  const loginAlert = document.getElementById('login-alert');
  const alertText = document.getElementById('alert-text');
  const loginCard = document.querySelector('.login-form-wrap');
  const rememberMeCheckbox = document.getElementById('remember-me');

  // ============================================================
  // 0. Auto-Login y Recordar Correo
  // ============================================================
  
  // 0.1 Verificar sesión activa
  fetch('/api/auth/verify', { headers: { 'Accept': 'application/json' } })
    .then(res => res.json())
    .then(data => {
      if (data.authenticated) {
        // Ya está logueado, redirigir directo
        window.location.href = 'dashboard.html';
      }
    })
    .catch(err => console.error('Error verificando sesión:', err));

  // 0.2 Cargar correo recordado si existe
  const savedEmail = localStorage.getItem('rememberedEmail');
  if (savedEmail) {
    emailInput.value = savedEmail;
    if (rememberMeCheckbox) rememberMeCheckbox.checked = true;
  }

  // ============================================================
  // Efecto Typewriter (Premium UI)
  // ============================================================
  const typewriterEl = document.getElementById('typewriter-text');
  if (typewriterEl) {
    const text1 = "Cuidamos tu sonrisa,";
    const text2 = "honramos tu confianza.";
    typewriterEl.innerHTML = ''; // Limpiar el texto original
    
    let i = 0;
    let j = 0;
    const speed = 40; // velocidad de escritura
    
    function typeWriter2() {
      if (j < text2.length) {
        typewriterEl.innerHTML += text2.charAt(j);
        j++;
        setTimeout(typeWriter2, speed);
      } else {
        // Al terminar, le damos un leve efecto de resplandor (Premium)
        typewriterEl.style.textShadow = '0 0 10px rgba(255,255,255,0.4)';
        typewriterEl.style.transition = 'text-shadow 1.5s ease';
      }
    }

    function typeWriter1() {
      if (i < text1.length) {
        typewriterEl.innerHTML += text1.charAt(i);
        i++;
        setTimeout(typeWriter1, speed);
      } else {
        typewriterEl.innerHTML += '<br>';
        setTimeout(typeWriter2, speed + 200); // Pequeña pausa antes de la segunda línea
      }
    }
    
    // Iniciar con un pequeño retraso para que la página cargue y el usuario preste atención
    setTimeout(typeWriter1, 500);
  }
  // ============================================================
  // 1. Mostrar/Ocultar Contraseña con Toggle Icono
  // ============================================================
  togglePasswordBtn.addEventListener('click', () => {
    const isPassword = passwordInput.getAttribute('type') === 'password';
    passwordInput.setAttribute('type', isPassword ? 'text' : 'password');

    // Cambiar dinámicamente el SVG del ojo (abierto / cerrado)
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

  // Limpieza de errores en foco/escritura
  emailInput.addEventListener('input', () => clearError('email'));
  passwordInput.addEventListener('input', () => clearError('password'));



  // ============================================================
  // 2. Envío Asíncrono de Formulario con Retardo de Animación
  // ============================================================
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validación del cliente
    let isValid = true;
    if (!email) {
      showError('email', 'El correo electrónico es obligatorio.');
      isValid = false;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        showError('email', 'Ingrese un formato de correo válido (ej: usuario@clinica.com).');
        isValid = false;
      }
    }

    if (!password) {
      showError('password', 'La contraseña es obligatoria.');
      isValid = false;
    }

    if (!isValid) return;

    // Activar estilo loading y cambiar texto
    btnSubmit.disabled = true;
    btnSubmit.classList.add('loading');
    btnText.textContent = 'Verificando...';

    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    // Fetch API y retardo mínimo de 1.5s para transiciones fluidas de UI
    const apiCall = fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, rememberMe })
    });

    const delay = new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const [response] = await Promise.all([apiCall, delay]);
      const data = await response.json();

      if (!response.ok) {
        // Error de credenciales: Mostrar toast de error y vibración de la tarjeta
        showToast(data.error || 'Credenciales incorrectas, por favor intente de nuevo', 'error');
        triggerShake();
        // Restaurar estado
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('loading');
        btnText.textContent = 'Ingresar al Sistema';

        // Mejoras de UX: Conservar el correo, limpiar solo la contraseña y enfocar
        passwordInput.value = '';
        passwordInput.focus();
        if (typeof resetPasswordToggle === 'function') resetPasswordToggle();
        
        return;
      }

      // Inicio exitoso: Guardar sesión y redirigir
      sessionStorage.setItem('user_name', data.user.name);
      sessionStorage.setItem('user_role', data.user.role);

      // Guardar o eliminar el correo recordado
      if (rememberMe) {
        localStorage.setItem('rememberedEmail', email);
      } else {
        localStorage.removeItem('rememberedEmail');
      }
      
      // Quitar la animación de difuminado y pasar directo al dashboard
      window.location.href = 'dashboard.html';

      } catch (err) {
        console.error('Error al iniciar sesión:', err);
        showToast('Error de conexión con el servidor. Inténtelo más tarde.', 'error');
        triggerShake();
        // Restaurar estado
        btnSubmit.disabled = false;
        btnSubmit.classList.remove('loading');
        btnText.textContent = 'Ingresar al Sistema';
      }
  });

  // ============================================================
  // Funciones Auxiliares de UI
  // ============================================================
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

  // Restablecer el botón de ver contraseña a estado oculto
  function resetPasswordToggle() {
    passwordInput.setAttribute('type', 'password');
    eyeIcon.innerHTML = `
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    `;
    togglePasswordBtn.setAttribute('aria-label', 'Mostrar contraseña');
  }

  function showAlert(message) {
    alertText.textContent = message;
    loginAlert.removeAttribute('hidden');
    // Force a browser reflow to register the removal of the hidden attribute, then add class
    loginAlert.offsetHeight;
    loginAlert.classList.add('show');
  }

  function hideAlert() {
    loginAlert.classList.remove('show');
    // Wait for the opacity/height transition to finish before hiding from layout
    setTimeout(() => {
      if (!loginAlert.classList.contains('show')) {
        loginAlert.setAttribute('hidden', '');
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
      btnText.setAttribute('hidden', '');
      spinner.removeAttribute('hidden');
    } else {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('loading');
      btnText.removeAttribute('hidden');
      setTimeout(() => {
        if (!btnSubmit.classList.contains('loading')) {
          spinner.setAttribute('hidden', '');
        }
      }, 300);
    }
  }
});
