document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-password-form');
  const emailInput = document.getElementById('email');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const spinner = btnSubmit.querySelector('.spinner');
  const recoveryAlert = document.getElementById('recovery-alert');
  const alertText = document.getElementById('alert-text');
  const loginCard = document.querySelector('.login-card');

  emailInput?.addEventListener('input', () => clearError('email'));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert();

    const email = emailInput.value.trim();

    // Validación del cliente
    let isValid = true;
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

    if (!isValid) return;

    setLoading(true);

    const apiCall = fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const delay = new Promise(resolve => setTimeout(resolve, 1500));

    try {
      const [response] = await Promise.all([apiCall, delay]);
      const data = await response.json();

      if (!response.ok) {
        showToast(data.error || 'Error al enviar la solicitud', 'error');
        triggerShake();
        setLoading(false);
        return;
      }

      // Éxito: Siempre decimos que se envió el enlace por seguridad
      showToast('Enlace de recuperación enviado. Revisa tu bandeja de entrada.', 'success');
      
      // Limpiar formulario y mantener botón inhabilitado
      emailInput.value = '';
      setLoading(false);
      btnSubmit.disabled = true;
      btnText.textContent = 'Enviado';

    } catch (err) {
      console.error('Error:', err);
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
    recoveryAlert.classList.remove('show');
    setTimeout(() => {
      if (!recoveryAlert.classList.contains('show')) {
        recoveryAlert.setAttribute('hidden', '');
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
      if (btnText) btnText.setAttribute('hidden', '');
      if (spinner) spinner.removeAttribute('hidden');
    } else {
      btnSubmit.disabled = false;
      btnSubmit.classList.remove('loading');
      if (btnText) btnText.removeAttribute('hidden');
      setTimeout(() => {
        if (!btnSubmit.classList.contains('loading')) {
          if (spinner) spinner.setAttribute('hidden', '');
        }
      }, 300);
    }
  }
});
