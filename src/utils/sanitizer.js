/**
 * ============================================================
 * sanitizer.js — Saneamiento y Estandarización de Datos (HU-008)
 * ============================================================
 * Contiene funciones utilitarias para limpiar y estandarizar entradas de usuarios.
 */

/**
 * Sanitiza el número de Cédula de Identidad (CI) de un paciente.
 * - Elimina espacios en blanco fantasiosos al inicio y al final (.trim()).
 * - Remueve todos los caracteres especiales como puntos, guiones, espacios internos o símbolos (/[^a-zA-Z0-9]/g).
 * - Convierte todas las letras a mayúsculas (.toUpperCase()) para unificar complementos y extensiones.
 * 
 * Ejemplo de comportamiento:
 * - " 1234567-A "    --> "1234567A"
 * - "12.345.67"      --> "1234567"
 * - " 12 345 67 - B" --> "1234567B"
 * 
 * @param {string} ciInput - El valor crudo ingresado por el usuario en el formulario.
 * @returns {string} El CI sanitizado listo para base de datos y búsquedas de unicidad.
 */
function sanitizarCI(ciInput) {
  if (typeof ciInput !== 'string') {
    return '';
  }
  
  // Expresión regular: /[^a-zA-Z0-9]/g
  // [^...] : Negación. Coincide con cualquier carácter que NO esté en la lista.
  // a-z, A-Z : Letras del alfabeto (sin acentos).
  // 0-9 : Números.
  // /g : Búsqueda global, reemplaza todos los caracteres coincidentes en el string.
  return ciInput
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();
}

module.exports = {
  sanitizarCI
};
