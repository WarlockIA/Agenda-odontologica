/**
 * ============================================================
 * toast.js — Sistema de Notificaciones Toast Premium
 * ============================================================
 * Expone la función global showToast(message, type) para
 * notificaciones flotantes, no intrusivas en la esquina
 * inferior derecha, con autodestrucción y barra de progreso.
 * ============================================================
 */

(function () {
  // SVG Icons correspondientes a cada estado
  const ICONS = {
    success: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
        <polyline points="22 4 12 14.01 9 11.01"></polyline>
      </svg>
    `,
    warning: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
    `,
    error: `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="15" y1="9" x2="9" y2="15"></line>
        <line x1="9" y1="9" x2="15" y2="15"></line>
      </svg>
    `
  };

  /**
   * Muestra una notificación en pantalla.
   * @param {string} message - Mensaje a mostrar.
   * @param {'success' | 'warning' | 'error'} type - Tipo de notificación.
   */
  function showToast(message, type = 'success') {
    // 1. Asegurar contenedor
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    } else {
      // Remover toasts anteriores para mostrar solo uno a la vez
      container.innerHTML = '';
    }

    // 2. Crear tarjeta de Toast
    const toast = document.createElement('div');
    toast.className = `toast-card toast-${type} animate-progress`;
    toast.setAttribute('role', 'alert');

    // 3. Obtener el icono SVG
    const iconSvg = ICONS[type] || ICONS.success;

    // 4. HTML del Toast (Diseño limpio sin icono lateral)
    toast.innerHTML = `
      <div class="toast-content">${escapeHtml(message)}</div>
      <button class="toast-close" aria-label="Cerrar notificación">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
      <div class="toast-progress-bar"></div>
    `;

    // 5. Agregar al contenedor
    container.appendChild(toast);

    // ── Lógica de destrucción del Toast ──
    let dismissTimeout;
    let removeTimeout;

    function destroyToast() {
      clearTimeout(dismissTimeout);
      clearTimeout(removeTimeout);

      toast.classList.add('fade-out');
      
      removeTimeout = setTimeout(() => {
        if (toast.parentNode) {
          toast.remove();
        }
        const activeContainer = document.getElementById('toast-container');
        if (activeContainer && activeContainer.children.length === 0) {
          activeContainer.remove();
        }
      }, 300);
    }

    // Autodestrucción en 4 segundos
    dismissTimeout = setTimeout(destroyToast, 4000);

    // Evento de cierre manual (eliminación instantánea)
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      clearTimeout(dismissTimeout);
      clearTimeout(removeTimeout);
      if (toast.parentNode) {
        toast.remove();
      }
      const activeContainer = document.getElementById('toast-container');
      if (activeContainer && activeContainer.children.length === 0) {
        activeContainer.remove();
      }
    });
  }

  // Utilidad: escapar HTML contra XSS
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Exponer globalmente
  window.showToast = showToast;
})();
