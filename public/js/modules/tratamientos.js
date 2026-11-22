// tratamientos.js — Módulo CRUD del Catálogo de Tratamientos y Autocompletados
import { state } from './state.js';
import { api } from './api.js';
import { showToast, showConfirmModal, openModalEl, closeModalEl, initCustomSelects, refreshCustomSelect } from './ui.js';
import { escapeHtml } from './utils.js';

// ─────────────────────────────────────────────────────────────
// Estado interno del módulo
// ─────────────────────────────────────────────────────────────

let currentSortField = 'nombre';
let currentSortDir = 'asc';
let editingTreatmentId = null;
let searchQuery = '';
let categoryFilter = '';

// ─────────────────────────────────────────────────────────────
// Carga y Caché de Tratamientos
// ─────────────────────────────────────────────────────────────

/**
 * Carga todos los tratamientos (activos e inactivos) en el state.
 * Expuesto para que dashboard.js pueda precargarlo al iniciar sesión.
 */
export async function loadTreatments() {
  try {
    const data = await api.getTreatments(false); // false = incluir inactivos
    state.treatments = data.treatments || [];
    return state.treatments;
  } catch (err) {
    console.error('Error al cargar tratamientos:', err);
    return [];
  }
}

/**
 * Retorna únicamente los tratamientos activos del caché (sin petición de red).
 * Si el caché está vacío, lo recarga primero.
 */
export async function getActiveTreatments() {
  if (!state.treatments || state.treatments.length === 0) {
    await loadTreatments();
  }
  return state.treatments.filter(t => t.activo === 1);
}

// ─────────────────────────────────────────────────────────────
// Renderizado de la Tabla del Catálogo
// ─────────────────────────────────────────────────────────────

function sortTreatments(list) {
  return [...list].sort((a, b) => {
    let valA, valB;
    switch (currentSortField) {
      case 'nombre':    valA = a.nombre.toLowerCase();    valB = b.nombre.toLowerCase();    break;
      case 'categoria': valA = (a.categoria || '').toLowerCase(); valB = (b.categoria || '').toLowerCase(); break;
      case 'costo':     valA = a.costo_base;              valB = b.costo_base;              break;
      case 'estado':    valA = a.activo;                  valB = b.activo;                  break;
      default:          valA = a.nombre.toLowerCase();    valB = b.nombre.toLowerCase();
    }
    if (valA < valB) return currentSortDir === 'asc' ? -1 : 1;
    if (valA > valB) return currentSortDir === 'asc' ?  1 : -1;
    return 0;
  });
}

function filterTreatments(list) {
  let filtered = list;
  if (categoryFilter) {
    const target = categoryFilter.toLowerCase().trim();
    filtered = filtered.filter(t => {
      const cat = (t.categoria || 'General').toLowerCase().trim();
      return cat === target || cat.includes(target) || target.includes(cat);
    });
  }
  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    filtered = filtered.filter(t =>
      t.nombre.toLowerCase().includes(q) ||
      (t.categoria || '').toLowerCase().includes(q)
    );
  }
  return filtered;
}

export function renderTreatmentsTable() {
  const container = document.getElementById('tratamientos-table-body');
  if (!container) return;

  // ── Actualizar tarjetas KPI ─────────────────────────────────
  const total = state.treatments.length;
  const activos = state.treatments.filter(t => t.activo === 1).length;
  const categorias = new Set(
    state.treatments.map(t => (t.categoria || 'General').trim().toLowerCase())
  ).size;
  const elTotal = document.getElementById('trat-kpi-total');
  const elActivos = document.getElementById('trat-kpi-activos');
  const elCategorias = document.getElementById('trat-kpi-categorias');
  if (elTotal) elTotal.textContent = total;
  if (elActivos) elActivos.textContent = activos;
  if (elCategorias) elCategorias.textContent = categorias;

  updateTreatmentFilterCategories();

  const filtered = filterTreatments(sortTreatments(state.treatments));
  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--text-muted);font-style:italic;">${searchQuery || categoryFilter ? 'No se encontraron tratamientos.' : 'No hay tratamientos registrados.'}</td></tr>`;
    return;
  }

  filtered.forEach((t) => {
    const color = t.color || '#3b82f6';
    const activo = t.activo === 1;

    const row = document.createElement('tr');
    if (!activo) row.style.opacity = '0.6';
    
    row.innerHTML = `
      <td>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-weight: 500;">${escapeHtml(t.nombre)}</span>
        </div>
      </td>
      <td><span class="inv-category-badge">${escapeHtml(t.categoria || 'General')}</span></td>
      <td><span style="font-weight: 500; font-size: 13.5px; color: var(--text-secondary);">${parseFloat(t.costo_base).toFixed(2)} Bs.</span></td>
      <td><span class="status-badge ${activo ? 'status-normal' : 'status-danger'}" style="font-size: 11px; padding: 4px 8px;">${activo ? 'ACTIVO' : 'INACTIVO'}</span></td>
      <td style="text-align: right;">
        <div style="display: flex; gap: 6px; justify-content: flex-end;">
          <button class="inv-action-btn btn-inv-edit btn-edit-treatment" data-id="${t.id}" title="Editar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
          <button class="inv-action-btn btn-inv-pause btn-toggle-treatment" data-id="${t.id}" data-active="${activo ? 'true' : 'false'}" title="${activo ? 'Pausar' : 'Reactivar'}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">${activo ? '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>' : '<polygon points="5 3 19 12 5 21 5 3"/>'}</svg></button>
          <button class="inv-action-btn btn-inv-delete btn-delete-treatment" data-id="${t.id}" data-name="${escapeHtml(t.nombre)}" title="Eliminar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
        </div>
      </td>
    `;
    container.appendChild(row);
  });
}

// ─────────────────────────────────────────────────────────────
// Formulario: Crear / Editar Tratamiento
// ─────────────────────────────────────────────────────────────

function resetTreatmentForm() {
  editingTreatmentId = null;
  const form = document.getElementById('treatment-form');
  if (form) form.reset();

  const title = document.getElementById('treatment-form-title');
  if (title) title.textContent = 'Registrar Tratamiento';

  const btnText = document.querySelector('#btn-save-treatment .btn-text');
  if (btnText) btnText.textContent = 'Registrar Tratamiento';

  const cancelBtn = document.getElementById('btn-cancel-treatment');
  if (cancelBtn) cancelBtn.style.display = 'none';

  const statusGroup = document.getElementById('treatment-status-group');
  if (statusGroup) statusGroup.style.display = 'none';

  const newCatWrapper = document.getElementById('new-category-wrapper');
  if (newCatWrapper) newCatWrapper.style.display = 'none';
  const catNewInput = document.getElementById('treatment-category-new');
  if (catNewInput) catNewInput.required = false;

  hideTreatmentAlert();
  hideTreatmentSuccess();
}

function fillTreatmentForm(treatment) {
  editingTreatmentId = treatment.id;

  const nameInput = document.getElementById('treatment-name');
  const costInput = document.getElementById('treatment-cost');
  const catInput  = document.getElementById('treatment-category');
  const activeChk = document.getElementById('treatment-active');

  if (nameInput) nameInput.value = treatment.nombre;
  if (costInput) costInput.value = treatment.costo_base;
  
  const newCatWrapper = document.getElementById('new-category-wrapper');
  const catNewInput = document.getElementById('treatment-category-new');
  if (catInput) {
    const options = Array.from(catInput.options).map(o => o.value);
    const catValue = treatment.categoria || 'General';
    if (!options.includes(catValue)) {
      catInput.value = 'Otra';
      if (newCatWrapper) newCatWrapper.style.display = 'block';
      if (catNewInput) {
        catNewInput.value = catValue;
        catNewInput.required = true;
      }
    } else {
      catInput.value = catValue;
      if (newCatWrapper) newCatWrapper.style.display = 'none';
      if (catNewInput) {
        catNewInput.value = '';
        catNewInput.required = false;
      }
    }
  }

  if (activeChk) activeChk.checked = treatment.activo === 1;

  
  const title = document.getElementById('treatment-form-title');
  if (title) title.textContent = 'Editar Tratamiento';

  const btnText = document.querySelector('#btn-save-treatment .btn-text');
  if (btnText) btnText.textContent = 'Guardar Cambios';

  const cancelBtn = document.getElementById('btn-cancel-treatment');
  if (cancelBtn) cancelBtn.style.display = '';

  const statusGroup = document.getElementById('treatment-status-group');
  if (statusGroup) statusGroup.style.display = '';

  hideTreatmentAlert();
  hideTreatmentSuccess();

  // Scroll al formulario
  const modalTreatment = document.getElementById('modal-treatment');
  if (modalTreatment) {
    openModalEl(modalTreatment);
  }
}


function showTreatmentAlert(msg) {
  const alert = document.getElementById('treatment-alert');
  const text  = document.getElementById('treatment-alert-text');
  if (text)  text.textContent = msg;
  if (alert) {
    alert.removeAttribute('hidden');
    alert.classList.add('shake-animation');
    setTimeout(() => alert.classList.remove('shake-animation'), 400);
  }
}

function hideTreatmentAlert() {
  document.getElementById('treatment-alert')?.setAttribute('hidden', '');
}

function showTreatmentSuccess(msg = 'Operación completada con éxito.') {
  const banner = document.getElementById('treatment-success');
  const text   = document.getElementById('treatment-success-text');
  if (text)   text.textContent = msg;
  if (banner) {
    banner.removeAttribute('hidden');
    setTimeout(() => banner.setAttribute('hidden', ''), 3500);
  }
}

function hideTreatmentSuccess() {
  document.getElementById('treatment-success')?.setAttribute('hidden', '');
}

function setTreatmentFormLoading(isLoading) {
  const btn     = document.getElementById('btn-save-treatment');
  const btnText = btn?.querySelector('.btn-text');
  const spinner = document.getElementById('treatment-spinner');
  if (btn)     btn.disabled = isLoading;
  if (btnText) btnText.style.opacity = isLoading ? '0' : '1';
  if (spinner) isLoading ? spinner.removeAttribute('hidden') : spinner.setAttribute('hidden', '');
}

// ─────────────────────────────────────────────────────────────
// Acciones CRUD
// ─────────────────────────────────────────────────────────────

async function saveTreatment(e) {
  e.preventDefault();
  hideTreatmentAlert();
  hideTreatmentSuccess();

  const nombre    = document.getElementById('treatment-name')?.value.trim();
  const costoRaw  = document.getElementById('treatment-cost')?.value;
  let categoria = document.getElementById('treatment-category')?.value.trim() || 'General';
  if (categoria === 'Otra') {
    categoria = document.getElementById('treatment-category-new')?.value.trim() || 'General';
  }
  const color     = document.getElementById('treatment-color')?.value || '#3b82f6';
  const activeChk = document.getElementById('treatment-active');
  const activo    = activeChk ? (activeChk.checked ? 1 : 0) : 1;

  // Validaciones básicas
  if (!nombre || nombre.length < 3) {
    showTreatmentAlert('El nombre del tratamiento debe tener al menos 3 caracteres.');
    document.getElementById('treatment-name')?.focus();
    return;
  }
  const costo_base = parseFloat(costoRaw);
  if (isNaN(costo_base) || costo_base <= 0) {
    showTreatmentAlert('Ingrese un costo base válido mayor a 0.');
    document.getElementById('treatment-cost')?.focus();
    return;
  }

  setTreatmentFormLoading(true);
  try {
    let res;
    if (editingTreatmentId) {
      res = await api.updateTreatment(editingTreatmentId, { nombre, costo_base, categoria, activo });
    } else {
      res = await api.createTreatment({ nombre, costo_base, categoria });
    }

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Error al guardar el tratamiento.');
    }

    const successMsg = editingTreatmentId ? 'Tratamiento actualizado con éxito.' : 'Tratamiento registrado con éxito.';
    showToast(successMsg, "success");
    const modalTreatment = document.getElementById("modal-treatment");
    if (modalTreatment) closeModalEl(modalTreatment);

    resetTreatmentForm();
    await loadTreatments();
    renderTreatmentsTable();

  } catch (err) {
    showTreatmentAlert(err.message);
  } finally {
    setTreatmentFormLoading(false);
  }
}

async function toggleTreatmentStatus(id, currentActivo) {
  const treatment = state.treatments.find(t => t.id === parseInt(id));
  if (!treatment) return;

  const willDeactivate = treatment.activo == 1 || treatment.activo === true;
  const nextActivo = willDeactivate ? 0 : 1;
  await doToggle(id, nextActivo);
}

async function doToggle(id, newActivo) {
  try {
    const treatment = state.treatments.find(t => t.id === parseInt(id));
    if (!treatment) return;

    const res = await api.updateTreatment(id, {
      nombre: treatment.nombre,
      costo_base: treatment.costo_base,
      categoria: treatment.categoria,
            activo: newActivo
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al actualizar el estado.');

    await loadTreatments();
    renderTreatmentsTable();
  } catch (err) {
    console.error('Error al cambiar estado del tratamiento:', err);
  }
}

async function deleteTreatment(id) {
  try {
    const res = await api.deleteTreatment(id);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Error al eliminar el tratamiento.');

    if (editingTreatmentId === parseInt(id)) resetTreatmentForm();
    await loadTreatments();
    renderTreatmentsTable();
    showToast('Tratamiento eliminado', 'info');
  } catch (err) {
    console.error('Error al eliminar tratamiento:', err);
    showToast(err.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// Autocompletado de Tratamientos (Citas y Ficha)
// ─────────────────────────────────────────────────────────────

/**
 * Agrupa los tratamientos activos por categoría para el menú desplegable.
 * @param {Array} treatments - Lista de tratamientos activos
 * @param {string} query - Texto de búsqueda para filtrar
 * @returns {Object} mapa { categoria: [tratamientos] }
 */
function groupByCategory(treatments, query = '') {
  const filtered = query
    ? treatments.filter(t => t.nombre.toLowerCase().includes(query.toLowerCase()))
    : treatments;

  return filtered.reduce((groups, t) => {
    const cat = t.categoria || 'General';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(t);
    return groups;
  }, {});
}

/**
 * Renderiza el dropdown de autocompletado con grupos de categorías.
 * @param {HTMLElement} suggestionsEl - El contenedor del dropdown
 * @param {Array} treatments - Tratamientos activos
 * @param {string} query - Texto actual del input
 * @param {Function} onSelect - Callback al seleccionar (recibe el objeto treatment)
 */
function renderTreatmentSuggestions(suggestionsEl, treatments, query, onSelect) {
  suggestionsEl.innerHTML = '';

  const grouped = groupByCategory(treatments, query);
  const categories = Object.keys(grouped);

  if (categories.length === 0) {
    suggestionsEl.setAttribute('hidden', '');
    return;
  }

  categories.forEach(cat => {
    // Cabecera de categoría
    const header = document.createElement('div');
    header.className = 'autocomplete-category-header';
    // Buscar el color de la categoría desde cualquier tratamiento del grupo
    const catColor = grouped[cat][0]?.color || '#3b82f6';
    header.innerHTML = `<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${catColor};margin-right:6px;vertical-align:middle;"></span>${escapeHtml(cat)}`;
    suggestionsEl.appendChild(header);

    // Items de tratamiento
    grouped[cat].forEach(t => {
      const item = document.createElement('div');
      item.className = 'treatment-suggestion-item';
      item.innerHTML = `
        <span style="color: var(--text-primary); font-size: 13.5px;">${escapeHtml(t.nombre)}</span>
        <span class="treatment-suggestion-cost">${parseFloat(t.costo_base).toFixed(2)} Bs.</span>
      `;
      item.addEventListener('mousedown', (e) => {
        e.preventDefault(); // evitar blur antes de click
        onSelect(t);
        suggestionsEl.setAttribute('hidden', '');
      });
      suggestionsEl.appendChild(item);
    });
  });

  suggestionsEl.removeAttribute('hidden');
}

/**
 * Inicializa el autocompletado de tratamientos en un input específico.
 * @param {string} inputId - ID del input de texto
 * @param {string} suggestionsId - ID del contenedor de sugerencias
 * @param {Function} onSelect - Callback al seleccionar un tratamiento
 */
export async function initTreatmentAutocomplete(inputId, suggestionsId, onSelect) {
  const input       = document.getElementById(inputId);
  const suggestions = document.getElementById(suggestionsId);
  if (!input || !suggestions) return;

  input.addEventListener('input', async () => {
    const q = input.value.trim();
    if (q.length < 1) {
      suggestions.setAttribute('hidden', '');
      return;
    }
    const activeTreatments = await getActiveTreatments();
    renderTreatmentSuggestions(suggestions, activeTreatments, q, (t) => {
      input.value = t.nombre;
      onSelect(t);
    });
  });

  input.addEventListener('focus', async () => {
    const q = input.value.trim();
    if (q.length >= 1) {
      const activeTreatments = await getActiveTreatments();
      renderTreatmentSuggestions(suggestions, activeTreatments, q, (t) => {
        input.value = t.nombre;
        onSelect(t);
      });
    }
  });

  input.addEventListener('blur', () => {
    // Pequeño delay para permitir que el mousedown del item se procese primero
    setTimeout(() => suggestions.setAttribute('hidden', ''), 180);
  });

  // Navegación con teclado
  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.treatment-suggestion-item');
    if (!items.length) return;
    const focused = suggestions.querySelector('.treatment-suggestion-item.keyboard-focus');
    let idx = Array.from(items).indexOf(focused);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (focused) focused.classList.remove('keyboard-focus');
      idx = (idx + 1) % items.length;
      items[idx].classList.add('keyboard-focus');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (focused) focused.classList.remove('keyboard-focus');
      idx = (idx - 1 + items.length) % items.length;
      items[idx].classList.add('keyboard-focus');
      items[idx].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' && focused) {
      e.preventDefault();
      focused.dispatchEvent(new MouseEvent('mousedown'));
    } else if (e.key === 'Escape') {
      suggestions.setAttribute('hidden', '');
    }
  });
}

// ─────────────────────────────────────────────────────────────
// Inicialización del Panel de Configuración
// ─────────────────────────────────────────────────────────────

const treatmentPriority = [
  'General',
  'Preventiva',
  'Restauración',
  'Endodoncia',
  'Cirugía',
  'Ortodoncia',
  'Estética',
  'Prótesis',
  'Periodoncia',
  'Implantología',
  'Otros'
];

function sortCategoriesByFrequency(categoriesSet, priorityOrder) {
  return Array.from(categoriesSet).sort((a, b) => {
    const idxA = priorityOrder.indexOf(a);
    const idxB = priorityOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
}

function updateTreatmentFilterCategories() {
  const selectEl = document.getElementById('treatments-filter-categoria');
  if (!selectEl) return;
  
  const currentValue = selectEl.value;
  const categories = new Set();
  
  if (Array.isArray(state.treatments)) {
    state.treatments.forEach(t => {
      if (t.categoria && t.categoria.trim()) {
        categories.add(t.categoria.trim());
      }
    });
  }

  if (categories.size === 0) {
    treatmentPriority.forEach(c => categories.add(c));
  }
  
  const sorted = sortCategoriesByFrequency(categories, treatmentPriority);
  let optionsHtml = '<option value="">Todas las categorías</option>';
  sorted.forEach(cat => {
    optionsHtml += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
  });
  
  selectEl.innerHTML = optionsHtml;
  if (currentValue && categories.has(currentValue)) {
    selectEl.value = currentValue;
  } else {
    selectEl.value = '';
    categoryFilter = '';
  }
  refreshCustomSelect(selectEl);
}

export async function loadAndRenderTreatments() {
  await loadTreatments();
  updateTreatmentFilterCategories();
  renderTreatmentsTable();
}

let handlersInitialized = false;



export function setupTreatmentsHandlers() {
  if (handlersInitialized) return;
  handlersInitialized = true;
  initCustomSelects();

  const modalTreatment = document.getElementById('modal-treatment');
  console.log("setupTreatmentsHandlers attached! modalTreatment:", !!modalTreatment);

  document.getElementById('btn-open-add-treatment')?.addEventListener('click', () => {
    console.log("Nuevo Tratamiento btn clicked!");
    resetTreatmentForm();
    if (modalTreatment) {
       console.log("Opening modal");
       openModalEl(modalTreatment);
    } else {
       console.log("Error: modalTreatment is null");
    }
  });

  document.getElementById('btn-close-treatment')?.addEventListener('click', () => {
    if (modalTreatment) closeModalEl(modalTreatment);
  });

  document.getElementById('treatment-category')?.addEventListener('change', (e) => {
    const newCatWrapper = document.getElementById('new-category-wrapper');
    const catNewInput = document.getElementById('treatment-category-new');
    if (e.target.value === 'Otra') {
      if (newCatWrapper) newCatWrapper.style.display = 'block';
      if (catNewInput) {
        catNewInput.required = true;
        catNewInput.focus();
      }
    } else {
      if (newCatWrapper) newCatWrapper.style.display = 'none';
      if (catNewInput) {
        catNewInput.required = false;
        catNewInput.value = '';
      }
    }
  });

  document.getElementById('treatment-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    saveTreatment(e);
  });

  document.getElementById('btn-cancel-treatment')?.addEventListener('click', () => {
    resetTreatmentForm();
    if (modalTreatment) closeModalEl(modalTreatment);
  });

  // Búsqueda
  document.getElementById('search-treatments-input')?.addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    renderTreatmentsTable();
  });

  // Filtro de Categoría
  document.getElementById('treatments-filter-categoria')?.addEventListener('change', (e) => {
    categoryFilter = e.target.value;
    renderTreatmentsTable();
  });

  // Delegación de eventos en la tabla
  document.getElementById('tratamientos-table-body')?.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('.btn-edit-treatment');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const treatment = state.treatments.find(t => t.id === id);
      if (treatment) fillTreatmentForm(treatment);
      return;
    }

    const toggleBtn = e.target.closest('.btn-toggle-treatment');
    if (toggleBtn) {
      await toggleTreatmentStatus(toggleBtn.dataset.id, toggleBtn.dataset.active);
      return;
    }

    const deleteBtn = e.target.closest('.btn-delete-treatment');
    if (deleteBtn) {
      await deleteTreatment(deleteBtn.dataset.id);
      return;
    }
  });
}

function hexToRgba(hex, alpha) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(59,130,246,${alpha})`;
  return `rgba(${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)},${alpha})`;
}
