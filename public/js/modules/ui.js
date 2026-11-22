// ui.js — Animaciones de Modales y Alertas
import { dom } from './dom.js';

export function openModalEl(modalEl) {
  modalEl.removeAttribute('hidden');
  modalEl.offsetHeight; // Force reflow
  modalEl.classList.add('show');
}

export function closeModalEl(modalEl, onClosed) {
  if (!modalEl) return;
  modalEl.classList.remove('show');
  modalEl.setAttribute('hidden', '');
  if (onClosed) onClosed();
}

// Delegación universal de eventos de cierre para botones "X" y "Cancelar"
document.addEventListener('click', (e) => {
  const closeBtn = e.target.closest('.modal-close-btn, .cancel-btn');
  if (closeBtn) {
    const modalEl = closeBtn.closest('.modal-overlay');
    if (modalEl && !modalEl.hasAttribute('hidden')) {
      e.preventDefault();
      closeModalEl(modalEl);
    }
  }
});

export function showAlertEl(alertEl) {
  if (!alertEl) return;
  alertEl.removeAttribute('hidden');
  alertEl.offsetHeight; // Force reflow
  alertEl.classList.add('show');
}

export function hideAlertEl(alertEl) {
  if (!alertEl) return;
  alertEl.classList.remove('show');
  const existingTimeout = alertEl.dataset.hideTimeout;
  if (existingTimeout) {
    clearTimeout(parseInt(existingTimeout));
  }
  const timeoutId = setTimeout(() => {
    if (!alertEl.classList.contains('show')) {
      alertEl.setAttribute('hidden', '');
    }
  }, 400);
  alertEl.dataset.hideTimeout = timeoutId;
}


export function showToast(message, type = 'success') {
  // Toast se carga desde js/toast.js en window, lo llamamos de forma segura
  if (typeof window.showToast === 'function') {
    window.showToast(message, type);
  } else {
    console.log(`[Toast ${type}]: ${message}`);
  }
}

export function showConfirmModal(title, message, isDanger, onAccept) {
  const confirmModal = document.getElementById('confirm-modal');
  const confirmTitle = document.getElementById('confirm-title');
  const confirmMsg = document.getElementById('confirm-message');
  const btnAccept = document.getElementById('btn-confirm-accept');
  const btnCancel = document.getElementById('btn-confirm-cancel');

  if (!confirmModal || !confirmTitle || !confirmMsg || !btnAccept || !btnCancel) return;

  confirmTitle.textContent = title;
  confirmMsg.textContent = message;

  if (isDanger) {
    btnAccept.style.background = 'linear-gradient(135deg, var(--danger) 0%, hsl(350, 80%, 45%) 100%)';
    btnAccept.style.boxShadow = '0 4px 14px var(--danger-border)';
  } else {
    btnAccept.style.background = 'linear-gradient(135deg, var(--primary) 0%, var(--primary-hover) 100%)';
    btnAccept.style.boxShadow = '0 4px 14px var(--primary-glow)';
  }

  // Reset handlers
  const newBtnAccept = btnAccept.cloneNode(true);
  btnAccept.parentNode.replaceChild(newBtnAccept, btnAccept);

  newBtnAccept.addEventListener('click', () => {
    closeModalEl(confirmModal);
    onAccept();
  });

  const closeConfirm = () => {
    closeModalEl(confirmModal);
  };

  btnCancel.onclick = closeConfirm;
  confirmModal.onclick = (e) => {
    if (e.target === confirmModal) closeConfirm();
  };

  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      closeConfirm();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);

  openModalEl(confirmModal);
}

export function initCustomSelects() {
  document.querySelectorAll('select.custom-select').forEach(select => {
    if (select.dataset.customized) return;
    select.dataset.customized = 'true';
    
    // Hide native select
    select.style.display = 'none';

    // Create wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'glass-select-wrapper';
    if (select.style.minWidth) wrapper.style.minWidth = select.style.minWidth;
    if (select.classList.contains('full-width')) wrapper.classList.add('full-width');

    // Create header
    const header = document.createElement('div');
    header.className = 'glass-select-header';
    const activeText = select.options[select.selectedIndex]?.text || select.options[0]?.text || '';
    header.innerHTML = `
      <span>${activeText}</span>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    `;

    // Create dropdown list
    const list = document.createElement('ul');
    list.className = 'glass-select-list';

    const updateSelection = (index) => {
      select.selectedIndex = index;
      header.querySelector('span').textContent = select.options[index]?.text || '';
      list.querySelectorAll('li').forEach((li, idx) => {
        if (idx === index) li.classList.add('selected');
        else li.classList.remove('selected');
      });
      select.dispatchEvent(new Event('change', { bubbles: true }));
    };

    Array.from(select.options).forEach((opt, idx) => {
      const li = document.createElement('li');
      li.textContent = opt.text;
      if (idx === select.selectedIndex) li.classList.add('selected');
      li.onclick = (e) => {
        e.stopPropagation();
        updateSelection(idx);
        closeList();
      };
      list.appendChild(li);
    });

    const closeList = () => {
      list.classList.remove('open');
      header.classList.remove('active');
    };

    const toggleList = (e) => {
      e.stopPropagation();
      const isOpen = list.classList.contains('open');
      document.querySelectorAll('.glass-select-list.open').forEach(l => {
        l.classList.remove('open');
        l.previousElementSibling?.classList.remove('active');
      });
      if (!isOpen) {
        list.classList.add('open');
        header.classList.add('active');
      }
    };

    header.onclick = toggleList;

    wrapper.appendChild(header);
    wrapper.appendChild(list);
    select.parentNode.insertBefore(wrapper, select.nextSibling);

    select.addEventListener('change', () => {
      const idx = select.selectedIndex;
      header.querySelector('span').textContent = select.options[idx]?.text || '';
      list.querySelectorAll('li').forEach((li, i) => {
        li.classList.toggle('selected', i === idx);
      });
    });
  });

  if (!window._glassSelectClickBound) {
    window._glassSelectClickBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.glass-select-wrapper')) {
        document.querySelectorAll('.glass-select-list.open').forEach(l => {
          l.classList.remove('open');
          l.previousElementSibling?.classList.remove('active');
        });
      }
    });
  }
}

export function refreshCustomSelect(selectEl) {
  if (!selectEl) return;
  const wrapper = selectEl.nextElementSibling;
  if (wrapper && wrapper.classList.contains('glass-select-wrapper')) {
    wrapper.remove();
    delete selectEl.dataset.customized;
    selectEl.style.display = '';
  }
  initCustomSelects();
}



