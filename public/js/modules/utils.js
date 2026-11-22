// utils.js — Funciones de Utilidad y Formateo
export function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

export function formatCurrency(val) {
  return parseFloat(val || 0).toLocaleString('es-BO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatPhoneInput(value) {
  let formatted = value.replace(/[^0-9+\- ]/g, '');
  if (formatted.indexOf('+') > 0) {
    formatted = formatted.charAt(0) + formatted.substring(1).replace(/\+/g, '');
  }
  return formatted;
}

export function validateBolivianPhone(number) {
  const clean = number.trim().replace(/[^0-9+]/g, '');
  if (!clean) return { isValid: true, message: '' };

  let localNum = clean;
  if (clean.startsWith('+591')) {
    localNum = clean.substring(4);
  } else if (clean.startsWith('591') && clean.length > 8) {
    localNum = clean.substring(3);
  }

  if (localNum.length === 8) {
    if (/^[67]/.test(localNum)) {
      return { isValid: true, message: '' };
    } else {
      return { isValid: false, message: 'Celular debe iniciar con 6 o 7.' };
    }
  } else if (localNum.length === 7) {
    if (/^[234]/.test(localNum)) {
      return { isValid: true, message: '' };
    } else {
      return { isValid: false, message: 'Teléfono fijo debe iniciar con 2, 3 o 4.' };
    }
  } else {
    return { isValid: false, message: 'Celular debe tener 8 dígitos; fijo debe tener 7.' };
  }
}
