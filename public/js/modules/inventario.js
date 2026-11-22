/**
 * inventario.js — Módulo ES de Inventario de Insumos
 * Clínica Odontológica "Cristo Rey"
 * 
 * Patrón idéntico al de reportes.js, settings.js, etc.
 * Se importa y controla desde dashboard.js.
 */

import { dom } from './dom.js';
import { showToast, initCustomSelects, openModalEl, closeModalEl, refreshCustomSelect } from './ui.js';
import { escapeHtml } from './utils.js';

// ── Estado ─────────────────────────────────────────────────────────────────
let allItems = [];
let editingItemId = null;

// ── Helpers de alerta ──────────────────────────────────────────────────────
function showAlert(el, textEl, msg) {
  if (textEl) textEl.textContent = msg;
  el?.removeAttribute('hidden');
  el?.classList.add('show');
  el?.classList.add('shake-animation');
  setTimeout(() => el?.classList.remove('shake-animation'), 500);
}

function hideAlert(el) {
  el?.setAttribute('hidden', '');
  el?.classList.remove('show');
}

// ── API ────────────────────────────────────────────────────────────────────
const invApi = {
  getItems: () => fetch('/api/inventario/items'),
  createItem: (body) => fetch('/api/inventario/items', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  updateItem: (id, body) => fetch(`/api/inventario/items/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  deleteItem: (id) => fetch(`/api/inventario/items/${id}`, { method: 'DELETE' }),
  getSuppliers: () => fetch('/api/inventario/suppliers'),
  createSupplier: (body) => fetch('/api/inventario/suppliers', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  updateSupplier: (id, body) => fetch(`/api/inventario/suppliers/${id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  deleteSupplier: (id) => fetch(`/api/inventario/suppliers/${id}`, { method: 'DELETE' }),
  registerTransaction: (body) => fetch('/api/inventario/transaction', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }),
  getDashboardMetrics: () => fetch('/api/inventario/dashboard-metrics'),
};

// ── Renderizado ────────────────────────────────────────────────────────────
function getStatusBadge(item) {
  if (item.dias_para_vencer !== null && item.dias_para_vencer < 0 && item.lotes_por_vencer > 0) {
    return `<span class="inv-badge inv-badge--expired" title="Lote vencido el ${item.prox_fecha_caducidad || ''}">🔴 Lote Vencido</span>`;
  }
  if ((item.lotes_por_vencer > 0) || (item.dias_para_vencer !== null && item.dias_para_vencer <= 30)) {
    const dias = item.dias_para_vencer ?? 0;
    const txtDias = dias === 0 ? 'hoy' : (dias === 1 ? '1 día' : `${dias}d`);
    return `<span class="inv-badge inv-badge--expiring" title="Próximo lote vence el ${item.prox_fecha_caducidad || ''}">⚠️ Vence en ${txtDias}</span>`;
  }
  if (item.stock_total <= 0) {
    return `<span class="inv-badge inv-badge--critical">● Agotado</span>`;
  }
  if (item.stock_total <= item.stock_minimo) {
    return `<span class="inv-badge inv-badge--low">▲ Stock Bajo</span>`;
  }
  return `<span class="inv-badge inv-badge--ok">✓ Normal</span>`;
}

function getRowClass(item) {
  if (item.dias_para_vencer !== null && item.dias_para_vencer < 0 && item.lotes_por_vencer > 0) return 'inv-row--critical';
  if ((item.lotes_por_vencer > 0) || (item.dias_para_vencer !== null && item.dias_para_vencer <= 30)) return 'inv-row--low';
  if (item.stock_total <= 0) return 'inv-row--critical';
  if (item.stock_total <= item.stock_minimo) return 'inv-row--low';
  return '';
}

function renderTable(items) {
  const tbody = dom.invTableBody;
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="inv-empty-row">No se encontraron insumos que coincidan con los filtros.</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map((item, i) => `
    <tr class="${getRowClass(item)}" data-id="${item.id}">
      <td style="color: var(--text-primary); font-weight: 600;">${item.nombre}</td>
      <td>${item.categoria ? `<span class="inv-cat-badge">${item.categoria}</span>` : '<span style="color:var(--text-muted)">—</span>'}</td>
      <td>${item.unidad_medida || '—'}</td>
      <td style="font-weight: 700; font-size: 16px; color: ${item.stock_total <= 0 ? 'var(--danger)' : item.stock_total <= item.stock_minimo ? 'hsl(38,92%,50%)' : 'var(--success)'};">
        ${item.stock_total}
      </td>
      <td style="color: var(--text-muted);">${item.stock_minimo}</td>
      <td>${getStatusBadge(item)}</td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="inv-action-btn btn-inv-mov" data-id="${item.id}" data-nombre="${item.nombre}" title="Registrar Entrada / Salida">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </button>
          <button class="inv-action-btn btn-inv-edit" data-id="${item.id}" title="Editar insumo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
          </button>
          <button class="inv-action-btn danger btn-inv-delete" data-id="${item.id}" title="Eliminar insumo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

function filterAndRender() {
  const q = dom.invSearchInput?.value.toLowerCase().trim() || '';
  const cat = dom.invFilterCategoria?.value || '';
  const estado = dom.invFilterEstado?.value || '';

  // Actualizar estado activo visual en tarjetas de KPI
  [dom.invKpiCardTotal, dom.invKpiCardLow, dom.invKpiCardExpiring].forEach(card => card?.classList.remove('active-kpi'));
  if (estado === 'low') dom.invKpiCardLow?.classList.add('active-kpi');
  else if (estado === 'expiring') dom.invKpiCardExpiring?.classList.add('active-kpi');
  else if (!estado && !cat && !q) dom.invKpiCardTotal?.classList.add('active-kpi');

  const filtered = allItems.filter(item => {
    const matchQ = !q || item.nombre.toLowerCase().includes(q) || (item.categoria && item.categoria.toLowerCase().includes(q));
    const matchCat = !cat || item.categoria === cat;
    
    let matchEstado = true;
    if (estado === 'expiring') {
      matchEstado = (item.lotes_por_vencer > 0) || (item.dias_para_vencer !== null && item.dias_para_vencer <= 30);
    } else if (estado === 'low') {
      matchEstado = item.stock_total > 0 && item.stock_total <= item.stock_minimo;
    } else if (estado === 'critical') {
      matchEstado = item.stock_total <= 0;
    }

    return matchQ && matchCat && matchEstado;
  });

  renderTable(filtered);
}

const invPriority = [
  'Consumibles',
  'Restauración',
  'Anestesia',
  'Protección',
  'Bioseguridad',
  'Instrumental',
  'Desinfección',
  'Impresiones',
  'Esterilización',
  'Laboratorio',
  'Endodoncia',
  'Prevención',
  'Cirugía',
  'Ortodoncia',
  'Aislamiento',
  'Cementación',
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

function updateCategoryFilterOptions(items) {
  const selectEl = dom.invFilterCategoria;
  if (!selectEl) return;
  
  const currentValue = selectEl.value;
  const categories = new Set(invPriority);
  
  if (Array.isArray(items)) {
    items.forEach(item => {
      if (item.categoria && item.categoria.trim()) {
        categories.add(item.categoria.trim());
      }
    });
  }
  
  const sorted = sortCategoriesByFrequency(categories, invPriority);
  let optionsHtml = '<option value="">Todas las categorías</option>';
  sorted.forEach(cat => {
    optionsHtml += `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`;
  });
  
  selectEl.innerHTML = optionsHtml;
  selectEl.value = currentValue;
  refreshCustomSelect(selectEl);
}

// ── Carga de datos (EXPORT PRINCIPAL) ──────────────────────────────────────
export async function loadInventario() {
  if (dom.invTableBody) {
    dom.invTableBody.innerHTML = `<tr><td colspan="7" class="inv-empty-row"><span class="spinner"></span>&nbsp;Cargando inventario...</td></tr>`;
  }

  try {
    const [itemsRes, metricsRes] = await Promise.all([
      invApi.getItems(),
      invApi.getDashboardMetrics(),
    ]);

    if (!itemsRes.ok || !metricsRes.ok) throw new Error('Error del servidor al cargar inventario.');

    const itemsData = await itemsRes.json();
    const metricsData = await metricsRes.json();

    if (itemsData.success) {
      allItems = itemsData.data;
      updateCategoryFilterOptions(allItems);
      filterAndRender();
    }

    if (metricsData.success) {
      const m = metricsData.data;
      if (dom.invKpiTotal) dom.invKpiTotal.textContent = m.total_items ?? 0;
      if (dom.invKpiLow) dom.invKpiLow.textContent = m.items_low_stock ?? 0;
      if (dom.invKpiExpiring) dom.invKpiExpiring.textContent = m.expiring_soon ?? 0;
    }
  } catch (err) {
    console.error('Error cargando inventario:', err);
    if (dom.invTableBody) {
      dom.invTableBody.innerHTML = `<tr><td colspan="7" class="inv-empty-row" style="color:var(--danger)">⚠ Error al cargar el inventario. Intente de nuevo.</td></tr>`;
    }
  }
}

// ── Mostrar/Ocultar campos según tipo movimiento ───────────────────────────
function updateMovFields() {
  const tipo = document.getElementById('mov-tipo')?.value;
  const isEntrada = tipo === 'ENTRADA';
  const lote = document.getElementById('mov-lote-fields');
  const cad = document.getElementById('mov-cad-fields');
  const costo = document.getElementById('mov-costo-fields');
  if (lote) lote.style.display = isEntrada ? '' : 'none';
  if (cad) cad.style.display = isEntrada ? '' : 'none';
  if (costo) costo.style.display = isEntrada ? '' : 'none';
}

let inventarioHandlersInitialized = false;

// ── Handlers (EXPORT SECUNDARIO) ───────────────────────────────────────────
export function initInventarioHandlers() {
  if (inventarioHandlersInitialized) return;
  inventarioHandlersInitialized = true;
  initCustomSelects();

  // Efecto Spotlight en Tarjetas de Inventario
  const invGrid = document.querySelector('.inv-kpi-grid');
  let invSpotlightTicker = null;
  invGrid?.addEventListener('mousemove', (e) => {
    if (invSpotlightTicker) return;
    invSpotlightTicker = requestAnimationFrame(() => {
      const cards = invGrid.querySelectorAll('.stat-card, .inv-kpi-card');
      cards.forEach(card => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        card.style.setProperty('--mouse-x', `${x}px`);
        card.style.setProperty('--mouse-y', `${y}px`);
      });
      invSpotlightTicker = null;
    });
  });

  // Filtros
  dom.invSearchInput?.addEventListener('input', filterAndRender);
  dom.invFilterCategoria?.addEventListener('change', filterAndRender);
  dom.invFilterEstado?.addEventListener('change', filterAndRender);

  // Clic en tarjetas de KPI para filtrar la tabla automáticamente
  [dom.invKpiCardTotal, dom.invKpiCardLow, dom.invKpiCardExpiring].forEach(card => {
    card?.addEventListener('click', () => {
      const filterVal = card.dataset.kpiFilter || '';
      if (dom.invFilterEstado) {
        dom.invFilterEstado.value = filterVal;
        refreshCustomSelect(dom.invFilterEstado);
        filterAndRender();
      }
    });
  });

  // ── Modal: Nuevo Insumo ──
  const modalAddItem = document.getElementById('modal-add-item');
  const formAddItem = document.getElementById('form-add-item');
  const addItemAlert = document.getElementById('add-item-alert');
  const addItemAlertText = document.getElementById('add-item-alert-text');
  const addItemSpinner = document.getElementById('add-item-spinner');

  document.getElementById('btn-open-add-item')?.addEventListener('click', () => {
    editingItemId = null;
    const titleEl = document.getElementById('modal-add-item-title');
    if (titleEl) titleEl.textContent = 'Nuevo Insumo';
    formAddItem?.reset();
    
    // Sync category custom select if present
    document.getElementById('item-categoria')?.dispatchEvent(new Event('change', { bubbles: true }));
    
    const newCatWrapper = document.getElementById('item-categoria-new-wrapper');
    if (newCatWrapper) newCatWrapper.style.display = 'none';
    
    hideAlert(addItemAlert);
    openModalEl(modalAddItem);
  });

  document.getElementById('item-categoria')?.addEventListener('change', (e) => {
    const newCatWrapper = document.getElementById('item-categoria-new-wrapper');
    if (e.target.value === 'Otra') {
      if (newCatWrapper) newCatWrapper.style.display = 'block';
    } else {
      if (newCatWrapper) newCatWrapper.style.display = 'none';
    }
  });

  ['btn-close-add-item', 'btn-close-modal-add-item', 'btn-cancel-add-item'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => closeModalEl(modalAddItem));
  });
  modalAddItem?.addEventListener('click', (e) => { if (e.target === modalAddItem) closeModalEl(modalAddItem); });

  formAddItem?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(addItemAlert);
    addItemSpinner?.removeAttribute('hidden');
    try {
      let categoriaVal = document.getElementById('item-categoria')?.value;
      if (categoriaVal === 'Otra') {
        categoriaVal = document.getElementById('item-categoria-new')?.value.trim() || 'Otros';
      }
      
      const body = {
        nombre: document.getElementById('item-nombre')?.value.trim(),
        categoria: categoriaVal,
        unidad_medida: document.getElementById('item-unidad')?.value.trim(),
        stock_minimo: parseInt(document.getElementById('item-stock-min')?.value) || 0,
      };
      
      let res;
      if (editingItemId) {
        res = await invApi.updateItem(editingItemId, body);
      } else {
        res = await invApi.createItem(body);
      }
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar el insumo');
      
      showToast(editingItemId ? 'Insumo actualizado 📦' : 'Insumo creado con éxito 📦', 'success');
      closeModalEl(modalAddItem);
      await loadInventario();
    } catch (err) {
      showAlert(addItemAlert, addItemAlertText, err.message);
    } finally {
      addItemSpinner?.setAttribute('hidden', '');
    }
  });

  // ── Modal: Movimiento ──
  const modalMov = document.getElementById('modal-mov');
  const formMov = document.getElementById('form-mov');
  const movAlert = document.getElementById('mov-alert');
  const movAlertText = document.getElementById('mov-alert-text');
  const movSpinner = document.getElementById('mov-spinner');

  document.getElementById('mov-tipo')?.addEventListener('change', updateMovFields);

  ['btn-close-mov', 'btn-cancel-mov'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => closeModalEl(modalMov));
  });
  modalMov?.addEventListener('click', (e) => { if (e.target === modalMov) closeModalEl(modalMov); });

  formMov?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(movAlert);
    movSpinner?.removeAttribute('hidden');
    try {
      const body = {
        item_id: parseInt(document.getElementById('mov-item-id')?.value),
        tipo: document.getElementById('mov-tipo')?.value,
        cantidad: parseInt(document.getElementById('mov-cantidad')?.value),
        motivo: document.getElementById('mov-motivo')?.value.trim(),
        numero_lote: document.getElementById('mov-numero-lote')?.value.trim() || null,
        fecha_caducidad: document.getElementById('mov-fecha-cad')?.value || null,
        costo_unitario: parseFloat(document.getElementById('mov-costo')?.value) || 0,
      };
      const res = await invApi.registerTransaction(body);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar el movimiento');
      showToast('Movimiento registrado ✓', 'success');
      closeModalEl(modalMov);
      await loadInventario();
    } catch (err) {
      showAlert(movAlert, movAlertText, err.message);
    } finally {
      movSpinner?.setAttribute('hidden', '');
    }
  });

  // Delegación en la tabla
  dom.invTableBody?.addEventListener('click', async (e) => {
    const movBtn = e.target.closest('.btn-inv-mov');
    if (movBtn) {
      formMov?.reset();
      hideAlert(movAlert);
      const movItemId = document.getElementById('mov-item-id');
      const movItemNombre = document.getElementById('mov-item-nombre');
      if (movItemId) movItemId.value = movBtn.dataset.id;
      if (movItemNombre) movItemNombre.textContent = movBtn.dataset.nombre;
      updateMovFields();
      
      // Sync mov-tipo custom select
      document.getElementById('mov-tipo')?.dispatchEvent(new Event('change', { bubbles: true }));
      
      openModalEl(modalMov);
      return;
    }

    const editBtn = e.target.closest('.btn-inv-edit');
    if (editBtn) {
      const id = parseInt(editBtn.dataset.id);
      const item = allItems.find(i => i.id === id);
      if (item) {
        editingItemId = id;
        const titleEl = document.getElementById('modal-add-item-title');
        if (titleEl) titleEl.textContent = 'Editar Insumo';
        
        document.getElementById('item-nombre').value = item.nombre;
        
        const catSelect = document.getElementById('item-categoria');
        if (catSelect) {
          catSelect.value = item.categoria || '';
          catSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }

        document.getElementById('item-unidad').value = item.unidad_medida || '';
        document.getElementById('item-stock-min').value = item.stock_minimo || 0;
        
        hideAlert(addItemAlert);
        openModalEl(modalAddItem);
      }
      return;
    }

    const delBtn = e.target.closest('.btn-inv-delete');
    if (delBtn) {
      try {
        const res = await invApi.deleteItem(delBtn.dataset.id);
        if (!res.ok) throw new Error('Error al eliminar');
        showToast('Insumo eliminado', 'info');
        await loadInventario();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // ── Modal: Directorio de Proveedores ──
  const modalSuppliersList = document.getElementById('modal-suppliers-list');
  const modalSupplier = document.getElementById('modal-add-supplier');
  const formSupplier = document.getElementById('form-add-supplier');
  const suppliersTableBody = document.getElementById('suppliers-table-body');
  let editingSupplierId = null;
  let allSuppliersList = [];

  async function loadAndRenderSuppliersList() {
    if (!suppliersTableBody) return;
    suppliersTableBody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px;">
          <span class="spinner" style="border-width: 2px; width: 16px; height: 16px; border-color: rgba(255,255,255,0.1); border-top-color: var(--primary); display: inline-block;"></span>
          <span style="margin-left: 8px; vertical-align: middle; color: var(--text-muted); font-size: 13px;">Cargando proveedores...</span>
        </td>
      </tr>
    `;

    try {
      const res = await invApi.getSuppliers();
      if (!res.ok) throw new Error('Error al obtener la lista de proveedores.');
      const data = await res.json();
      allSuppliersList = data.data || [];

      suppliersTableBody.innerHTML = '';
      if (allSuppliersList.length === 0) {
        suppliersTableBody.innerHTML = `
          <tr>
            <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted); font-style: italic;">No hay proveedores registrados.</td>
          </tr>
        `;
        return;
      }

      allSuppliersList.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td style="padding: 12px 14px; font-weight: 700; color: var(--text-primary);">${escapeHtml(s.nombre_empresa)}</td>
          <td style="padding: 12px 14px; color: var(--text-secondary);">${escapeHtml(s.contacto || '-')}</td>
          <td style="padding: 12px 14px; font-weight: 500; color: var(--success);">${escapeHtml(s.telefono || '-')}</td>
          <td style="padding: 12px 14px; color: #60a5fa;">${escapeHtml(s.email || '-')}</td>
          <td style="padding: 12px 14px; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 8px;">
              <button type="button" class="btn-edit-supplier" data-id="${s.id}" title="Editar Proveedor" style="background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); padding: 6px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button type="button" class="btn-delete-supplier" data-id="${s.id}" data-nombre="${escapeHtml(s.nombre_empresa)}" title="Eliminar Proveedor" style="background: rgba(239, 68, 68, 0.12); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.25); padding: 6px 10px; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; justify-content: center;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </td>
        `;
        suppliersTableBody.appendChild(tr);
      });
    } catch (err) {
      console.error(err);
      suppliersTableBody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: var(--danger);">Error al cargar los proveedores.</td>
        </tr>
      `;
    }
  }

  // Abrir directorio de proveedores
  document.getElementById('btn-open-suppliers-list')?.addEventListener('click', () => {
    loadAndRenderSuppliersList();
    openModalEl(modalSuppliersList);
  });

  ['btn-close-modal-suppliers-list', 'btn-close-suppliers-list-footer'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => closeModalEl(modalSuppliersList));
  });
  modalSuppliersList?.addEventListener('click', (e) => { if (e.target === modalSuppliersList) closeModalEl(modalSuppliersList); });

  // Delegar edición y eliminación de proveedor
  suppliersTableBody?.addEventListener('click', async (e) => {
    const btnEdit = e.target.closest('.btn-edit-supplier');
    if (btnEdit) {
      const id = parseInt(btnEdit.dataset.id, 10);
      const s = allSuppliersList.find(sup => sup.id === id);
      if (s) {
        editingSupplierId = id;
        const titleEl = document.getElementById('modal-supplier-title');
        if (titleEl) titleEl.textContent = 'Editar Proveedor';
        
        document.getElementById('supplier-nombre').value = s.nombre_empresa || '';
        document.getElementById('supplier-contacto').value = s.contacto || '';
        document.getElementById('supplier-telefono').value = s.telefono || '';
        document.getElementById('supplier-email').value = s.email || '';
        
        closeModalEl(modalSuppliersList);
        openModalEl(modalSupplier);
      }
      return;
    }

    const btnDel = e.target.closest('.btn-delete-supplier');
    if (btnDel) {
      const id = btnDel.dataset.id;
      try {
        const res = await invApi.deleteSupplier(id);
        if (!res.ok) throw new Error('Error al eliminar el proveedor.');
        showToast('Proveedor eliminado', 'info');
        await loadAndRenderSuppliersList();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  });

  // Abrir modal de nuevo proveedor desde el directorio
  const openNewSupplierForm = () => {
    editingSupplierId = null;
    const titleEl = document.getElementById('modal-supplier-title');
    if (titleEl) titleEl.textContent = 'Registrar Nuevo Proveedor';
    formSupplier?.reset();
    closeModalEl(modalSuppliersList);
    openModalEl(modalSupplier);
  };

  document.getElementById('btn-open-add-supplier-inner')?.addEventListener('click', openNewSupplierForm);
  document.getElementById('btn-open-add-supplier')?.addEventListener('click', openNewSupplierForm);

  const handleSupplierModalClose = () => {
    closeModalEl(modalSupplier);
    if (editingSupplierId !== null) {
      openModalEl(modalSuppliersList);
      loadAndRenderSuppliersList();
      editingSupplierId = null;
    }
  };

  ['btn-close-modal-supplier', 'btn-cancel-supplier'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', handleSupplierModalClose);
  });
  modalSupplier?.addEventListener('click', (e) => { if (e.target === modalSupplier) handleSupplierModalClose(); });

  formSupplier?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const supplierSpinner = document.getElementById('supplier-spinner');
    supplierSpinner?.removeAttribute('hidden');

    try {
      const body = {
        nombre_empresa: document.getElementById('supplier-nombre')?.value.trim(),
        contacto: document.getElementById('supplier-contacto')?.value.trim() || null,
        telefono: document.getElementById('supplier-telefono')?.value.trim() || null,
        email: document.getElementById('supplier-email')?.value.trim() || null,
      };

      let res;
      const isEditing = !!editingSupplierId;
      if (isEditing) {
        res = await invApi.updateSupplier(editingSupplierId, body);
      } else {
        res = await invApi.createSupplier(body);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar proveedor.');

      showToast(isEditing ? 'Proveedor actualizado 🏢' : 'Proveedor registrado con éxito 🏢', 'success');
      closeModalEl(modalSupplier);
      
      // Si se editó o si el directorio estaba abierto, volver a abrirlo y actualizarlo
      if (isEditing || (modalSuppliersList && !modalSuppliersList.hasAttribute('hidden'))) {
        await loadAndRenderSuppliersList();
        openModalEl(modalSuppliersList);
      }
      editingSupplierId = null;
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      supplierSpinner?.setAttribute('hidden', '');
    }
  });
}
