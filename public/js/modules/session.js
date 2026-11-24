// session.js — Gestión de Sesiones y Control de Perfil por Rol
import { dom } from './dom.js';
import { api } from './api.js';
import { showToast, openModalEl, closeModalEl } from './ui.js';

let currentUser = null;

export function setupUserProfile(user) {
  if (dom.profileName) dom.profileName.textContent = user.name;
  if (dom.profileRole) dom.profileRole.textContent = user.role;

  if (dom.navLinkSettings) {
    dom.navLinkSettings.style.display = user.role === 'odontologo' ? 'block' : 'none';
  }
  if (dom.navLinkReports) {
    dom.navLinkReports.style.display = user.role === 'odontologo' ? 'block' : 'none';
  }
  const navLinkPrediction = document.getElementById('nav-link-prediction');
  if (navLinkPrediction) {
    navLinkPrediction.style.display = user.role === 'odontologo' ? 'block' : 'none';
  }
  if (dom.navLinkInventario) {
    dom.navLinkInventario.style.display = user.role === 'odontologo' ? 'block' : 'none';
  }
  if (dom.navLinkTratamientos) {
    dom.navLinkTratamientos.style.display = user.role === 'odontologo' ? 'block' : 'none';
  }

  // Calcular iniciales del avatar
  if (dom.avatarInitials && user.name) {
    const parts = user.name.split(' ');
    const skip  = ['dr.','dr','dra.','dra','sra.','sr.','sr'];
    let i1 = parts[0], i2 = parts[1] || '';
    if (parts.length >= 3 && skip.includes(parts[0].toLowerCase())) {
      i1 = parts[1]; i2 = parts[2];
    }
    dom.avatarInitials.textContent = (i1[0] + (i2[0] || '')).toUpperCase();
  }

  currentUser = user;
}

export async function verifySession(onSuccess) {
  try {
    const data = await api.verifySession();
    setupUserProfile(data.user);
    if (onSuccess) {
      try {
        await onSuccess();
      } catch (initErr) {
        console.error('Error durante la inicialización del dashboard:', initErr);
      }
    }
  } catch (error) {
    console.warn('Verificación de sesión fallida:', error.message);
    window.location.href = 'index.html';
  } finally {
    document.body.classList.remove('loading');
  }
}

// Lógica del Modal "Mi Perfil"
export function setupProfileHandlers() {
  const btnEditProfile = document.getElementById('btn-edit-profile');
  const modalProfile = document.getElementById('modal-profile');
  const btnCloseProfile = document.getElementById('btn-close-profile');
  const btnCancelProfile = document.getElementById('btn-cancel-profile');
  const profileForm = document.getElementById('profile-form');

  const inputName = document.getElementById('profile-name-input');
  const inputEmail = document.getElementById('profile-email-input');
  const inputPassword = document.getElementById('profile-password-input');
  
  const spinner = document.getElementById('profile-spinner');
  const btnText = profileForm?.querySelector('.btn-text');

  const toggleProfilePassword = document.getElementById('toggle-profile-password');
  const profileEyeIcon = document.getElementById('profile-eye-icon');

  if (!btnEditProfile || !modalProfile) return;

  if (toggleProfilePassword && profileEyeIcon) {
    toggleProfilePassword.addEventListener('click', () => {
      const isPassword = inputPassword.getAttribute('type') === 'password';
      inputPassword.setAttribute('type', isPassword ? 'text' : 'password');

      if (isPassword) {
        profileEyeIcon.innerHTML = `
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
          <line x1="1" y1="1" x2="23" y2="23"/>
        `;
        toggleProfilePassword.setAttribute('aria-label', 'Ocultar contraseña');
      } else {
        profileEyeIcon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
        toggleProfilePassword.setAttribute('aria-label', 'Mostrar contraseña');
      }
    });
  }

  function openProfileModal() {
    if (currentUser) {
      inputName.value = currentUser.name;
      inputEmail.value = currentUser.email;
      inputPassword.value = '';
      
      // Limpiar errores
      ['name', 'email', 'password'].forEach(field => {
        const errSpan = document.getElementById(`profile-${field}-error`);
        if (errSpan) errSpan.textContent = '';
        const input = document.getElementById(`profile-${field}-input`);
        if (input) input.style.borderColor = '';
      });

      // Asegurar que la contraseña esté oculta al abrir el modal
      if (inputPassword && profileEyeIcon) {
        inputPassword.setAttribute('type', 'password');
        profileEyeIcon.innerHTML = `
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
          <circle cx="12" cy="12" r="3"/>
        `;
        if (toggleProfilePassword) {
          toggleProfilePassword.setAttribute('aria-label', 'Mostrar contraseña');
        }
      }

      openModalEl(modalProfile);
    }
  }

  function closeProfileModal() {
    closeModalEl(modalProfile);
  }

  btnEditProfile.addEventListener('click', openProfileModal);
  btnCloseProfile.addEventListener('click', closeProfileModal);
  btnCancelProfile.addEventListener('click', closeProfileModal);

  profileForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = inputName.value.trim();
    const email = inputEmail.value.trim();
    const password = inputPassword.value;

    let isValid = true;
    if (name.length < 3) {
      document.getElementById('profile-name-error').textContent = 'Mínimo 3 caracteres';
      inputName.style.borderColor = 'var(--danger)';
      isValid = false;
    }
    if (!email) {
      document.getElementById('profile-email-error').textContent = 'Correo obligatorio';
      inputEmail.style.borderColor = 'var(--danger)';
      isValid = false;
    }

    if (!isValid) return;

    if (spinner) spinner.removeAttribute('hidden');
    if (btnText) btnText.setAttribute('hidden', '');

    try {
      // Usar la instancia API global si existe, o usar fetch directo
      const response = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email, password })
      });

      const data = await response.json();

      if (response.ok) {
        showToast('Perfil actualizado correctamente', 'success');
        setupUserProfile(data.user); // Actualiza la UI de inmediato
        closeProfileModal();
      } else {
        showToast(data.error || 'Error al actualizar', 'error');
      }
    } catch (error) {
      showToast('Error de conexión', 'error');
    } finally {
      if (spinner) spinner.setAttribute('hidden', '');
      if (btnText) btnText.removeAttribute('hidden');
    }
  });
}
