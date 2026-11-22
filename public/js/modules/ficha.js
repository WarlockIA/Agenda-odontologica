// ficha.js — Ficha Clínica, Odontograma FDI y Historial Clínico
import { dom } from './dom.js';
import { state } from './state.js';
import { api } from './api.js';
import { openModalEl, closeModalEl, showToast, showAlertEl, hideAlertEl, showConfirmModal } from './ui.js';
import { escapeHtml } from './utils.js';
import { loadPatients } from './pacientes.js';
import { initTreatmentAutocomplete } from './tratamientos.js?v=7';

let activeFichaPatientId = null;
let activeFichaPatientName = '';
let activeFichaPatientCI = '';

const cuadrantesDef = {
  quad1Perm: [18, 17, 16, 15, 14, 13, 12, 11],
  quad1Dec:  [55, 54, 53, 52, 51],
  quad2Perm: [21, 22, 23, 24, 25, 26, 27, 28],
  quad2Dec:  [61, 62, 63, 64, 65],
  quad4Perm: [48, 47, 46, 45, 44, 43, 42, 41],
  quad4Dec:  [85, 84, 83, 82, 81],
  quad3Perm: [31, 32, 33, 34, 35, 36, 37, 38],
  quad3Dec:  [71, 72, 73, 74, 75]
};

// ────────────────────────────────────────────────────────────
// Módulo Clínico de Citas (Registro de Historial por Cita)
// ────────────────────────────────────────────────────────────

function showClinicalAlert(msg) {
  if (dom.clinicalAlertText) dom.clinicalAlertText.textContent = msg;
  showAlertEl(dom.clinicalAlert);
  dom.clinicalAlert?.classList.add('shake-animation');
  setTimeout(() => {
    dom.clinicalAlert?.classList.remove('shake-animation');
  }, 400);
}

function hideClinicalAlert() {
  hideAlertEl(dom.clinicalAlert);
}

function setClinicalLoading(isLoading) {
  const btnSubmit = dom.clinicalForm?.querySelector('button[type="submit"]');
  const btnText = btnSubmit?.querySelector('.btn-text');
  if (!btnSubmit) return;
  btnSubmit.disabled = isLoading;
  if (btnText) btnText.style.opacity = isLoading ? '0' : '1';
  if (dom.clinicalSpinner) isLoading ? dom.clinicalSpinner.removeAttribute('hidden') : dom.clinicalSpinner.setAttribute('hidden', '');
}

export async function openClinicalModal(card) {
  const apptId = card.dataset.id;
  const patientName = card.dataset.patient;
  const date = card.dataset.date;
  const time = card.dataset.time;

  state.activeClinicalApptId = apptId;
  hideClinicalAlert();
  
  const errEl = document.getElementById('clinical-observations-error');
  if (errEl) errEl.textContent = '';
  if (dom.clinicalObservations) dom.clinicalObservations.style.borderColor = '';
  dom.clinicalForm.reset();

  if (dom.clinicalPatientName) dom.clinicalPatientName.textContent = patientName;
  if (dom.clinicalApptInfo) dom.clinicalApptInfo.textContent = `Cita #${apptId} — ${date} (${time})`;

  // 1. Cargar el catálogo de tratamientos activos
  dom.clinicalTreatmentsList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin: 0;">Cargando tratamientos...</p>';
  
  let activeTreatments = [];
  try {
    const data = await api.getTreatments(true);
    activeTreatments = data.treatments || [];
  } catch (err) {
    console.error('Error al cargar tratamientos:', err);
  }

  // 2. Cargar historial clínico guardado si existe
  let savedHistory = null;
  try {
    const data = await api.getClinicalHistory(apptId);
    savedHistory = data.history;
  } catch (err) {
    console.error('Error al cargar historial clínico guardado:', err);
  }

  // 3. Renderizar checkboxes de tratamientos y pre-seleccionar los guardados
  dom.clinicalTreatmentsList.innerHTML = '';
  if (activeTreatments.length === 0) {
    dom.clinicalTreatmentsList.innerHTML = '<p style="color: var(--text-muted); font-size: 13px; margin: 0;">No hay tratamientos activos en el catálogo.</p>';
  } else {
    activeTreatments.forEach(treat => {
      const isSelected = savedHistory && savedHistory.tratamientos && savedHistory.tratamientos.some(t => t.id === treat.id);
      
      const label = document.createElement('label');
      label.className = 'treatment-item-checkbox';
      if (isSelected) label.classList.add('selected');
      
      label.innerHTML = `
        <input type="checkbox" name="treatment" value="${treat.id}" ${isSelected ? 'checked' : ''}>
        <span class="custom-checkbox-indicator"></span>
        <span class="treatment-name">${escapeHtml(treat.nombre)} <span class="treatment-cost">${treat.costo_base.toFixed(2)} Bs.</span></span>
      `;
      
      // Toggle highlight class when user clicks
      label.querySelector('input').addEventListener('change', (e) => {
        if (e.target.checked) {
          label.classList.add('selected');
        } else {
          label.classList.remove('selected');
        }
      });
      
      dom.clinicalTreatmentsList.appendChild(label);

    });
  }

  // 4. Pre-rellenar observaciones guardadas
  if (savedHistory && savedHistory.observaciones_clinicas && dom.clinicalObservations) {
    dom.clinicalObservations.value = savedHistory.observaciones_clinicas;
  }

  openModalEl(dom.clinicalModal);
  dom.clinicalObservations?.focus();
}

export function closeClinicalModal() {
  closeModalEl(dom.clinicalModal, () => {
    state.activeClinicalApptId = null;
    hideClinicalAlert();
    dom.clinicalForm.reset();
    setClinicalLoading(false);
  });
}

// ────────────────────────────────────────────────────────────
// Ficha Clínica y Odontograma Digital (FDI Chart)
// ────────────────────────────────────────────────────────────

function updateFaceColor(poly, stateVal) {
  poly.dataset.state = stateVal;
  if (stateVal === 'caries') {
    poly.style.fill = 'var(--danger)'; // Red
  } else if (stateVal === 'obturado') {
    poly.style.fill = '#3b82f6'; // Blue
  } else if (stateVal === 'extraido') {
    poly.style.fill = '#000000'; // Black
  } else {
    poly.style.fill = '#334155'; // Dark slate blue (sano)
  }
}

function createToothSVG(piezaId) {
  const div = document.createElement('div');
  div.className = 'diente-svg-item';
  div.dataset.pieza = piezaId;
  div.title = `Pieza FDI ${piezaId}`;
  
  const span = document.createElement('span');
  span.className = 'pieza-label';
  span.textContent = piezaId;
  div.appendChild(span);
  
  // Layer: Corona
  const layerCorona = document.createElement('div');
  layerCorona.className = 'tooth-layer-corona';
  div.appendChild(layerCorona);
  
  // Layer: Endodoncia
  const layerEndo = document.createElement('div');
  layerEndo.className = 'tooth-layer-endodoncia';
  div.appendChild(layerEndo);
  
  // Layer: Extraccion (X)
  const layerExtra = document.createElement('div');
  layerExtra.className = 'tooth-layer-extraccion';
  layerExtra.innerHTML = '&#10005;'; // X character
  div.appendChild(layerExtra);
  
  // Layer: Implante
  const layerImplante = document.createElement('div');
  layerImplante.className = 'tooth-layer-implante';
  layerImplante.textContent = 'IMP';
  div.appendChild(layerImplante);
  
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  
  const faces = [
    { name: 'top', points: "10,10 90,10 70,30 30,30" },
    { name: 'right', points: "90,10 90,90 70,70 70,30" },
    { name: 'bottom', points: "10,90 90,90 70,70 30,70" },
    { name: 'left', points: "10,10 10,90 30,70 30,30" },
    { name: 'center', points: "30,30 70,30 70,70 30,70" }
  ];
  
  faces.forEach(f => {
    const poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    poly.setAttribute("points", f.points);
    poly.dataset.cara = f.name;
    poly.dataset.state = 'sano';
    poly.style.fill = '#334155'; // Base color (sano)
    
    poly.addEventListener('click', (e) => {
      e.stopPropagation();
      handleToothClick(piezaId, f.name, div);
    });
    
    svg.appendChild(poly);
  });
  
  div.appendChild(svg);
  
  div.addEventListener('click', () => {
    handleToothClick(piezaId, 'tooth', div);
  });
  
  return div;
}

function handleToothClick(piezaId, clickedPart, div) {
  if (dom.evoDiente) dom.evoDiente.value = piezaId;
  
  const isAlreadyFiltered = state.filteredToothId === piezaId;
  document.querySelectorAll('.diente-svg-item').forEach(el => el.classList.remove('selected'));
  
  if (isAlreadyFiltered && state.activeOdontogramaTool === null) {
    state.filteredToothId = null;
    if (dom.fichaFilterBadge) dom.fichaFilterBadge.style.display = 'none';
  } else {
    state.filteredToothId = piezaId;
    div.classList.add('selected');
    if (dom.fichaFilterBadge && dom.fichaFilterToothId) {
      dom.fichaFilterToothId.textContent = piezaId;
      dom.fichaFilterBadge.style.display = 'flex';
    }
  }
  renderEvolucionTable(state.activeFichaEvolution);
  
  const odontRole = dom.profileRole ? dom.profileRole.textContent.trim().toLowerCase() : '';
  if (odontRole !== 'odontologo') {
    if (state.activeOdontogramaTool) {
      showToast('Solo los odontólogos pueden editar el odontograma.', 'warning');
    }
    return;
  }
  
  if (!state.activeOdontogramaTool) return; // No tool selected, just selecting tooth
  
  const tool = state.activeOdontogramaTool;
  const currentStates = state.currentOdontogramaState[piezaId] || { wholeTooth: null, faces: {} };
  if (!currentStates.faces) currentStates.faces = {}; // Migrate old data
  
  const globalTools = ['extraido', 'corona', 'endodoncia', 'implante'];
  const isGlobalTool = globalTools.includes(tool);
  
  if (tool === 'sano') {
    if (clickedPart === 'tooth' || isGlobalTool) {
      // Clear global states
      currentStates.wholeTooth = null;
      currentStates.corona = false;
      currentStates.endodoncia = false;
      currentStates.implante = false;
    } else {
      // Clear specific face
      currentStates.faces[clickedPart] = 'sano';
    }
  } else if (isGlobalTool) {
    // Toggle global tool
    if (tool === 'extraido') {
      currentStates.wholeTooth = currentStates.wholeTooth === 'extraido' ? null : 'extraido';
    } else {
      currentStates[tool] = !currentStates[tool];
    }
  } else {
    // Face tools (caries, obturado)
    if (clickedPart !== 'tooth') {
      currentStates.faces[clickedPart] = currentStates.faces[clickedPart] === tool ? 'sano' : tool;
    }
  }
  
  state.currentOdontogramaState[piezaId] = currentStates;
  applyOdontogramaColorsToTooth(piezaId, div);
  saveActiveFichaDetailsSilent();
}

function applyOdontogramaColorsToTooth(piezaId, div) {
  const toothState = state.currentOdontogramaState[piezaId] || { wholeTooth: null, faces: {} };
  
  // Faces
  div.querySelectorAll('polygon').forEach(poly => {
    const cara = poly.dataset.cara;
    const faceState = (toothState.faces && toothState.faces[cara]) ? toothState.faces[cara] : (toothState[cara] || 'sano');
    updateFaceColor(poly, faceState);
  });
  
  // Clear old layers
  div.querySelectorAll('.tooth-layer-corona, .tooth-layer-extraccion, .tooth-layer-endodoncia, .tooth-layer-implante').forEach(el => el.remove());
  
  // Re-create layers with SVGs and INLINE styles for guaranteed positioning
  const layerCorona = document.createElement('div');
  layerCorona.className = 'tooth-layer-corona';
  layerCorona.style.cssText = 'position: absolute; top: auto; bottom: 3px; left: 50%; margin-left: -16px; width: 32px; height: 32px; border: 2px solid #fbbf24; border-radius: 4px; box-sizing: border-box; pointer-events: none; z-index: 10; box-shadow: 0 0 6px rgba(251, 191, 36, 0.4); display: block;';
  div.appendChild(layerCorona);

  const layerExtra = document.createElement('div');
  layerExtra.className = 'tooth-layer-extraccion';
  layerExtra.style.cssText = 'position: absolute; top: auto; bottom: 7px; left: 50%; margin-left: -12px; width: 24px; height: 24px; pointer-events: none; z-index: 10; filter: drop-shadow(0 0 2px rgba(0,0,0,0.5)); display: block;';
  layerExtra.innerHTML = `<svg viewBox="0 0 24 24" style="width: 24px !important; height: 24px !important; display: block;"><line x1="2" y1="2" x2="22" y2="22" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/><line x1="22" y1="2" x2="2" y2="22" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"/></svg>`;
  div.appendChild(layerExtra);
  
  const layerEndo = document.createElement('div');
  layerEndo.className = 'tooth-layer-endodoncia';
  layerEndo.style.cssText = 'position: absolute; top: auto; bottom: 7px; left: 50%; margin-left: -12px; width: 24px; height: 24px; pointer-events: none; z-index: 10; filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)); display: block;';
  layerEndo.innerHTML = `<svg viewBox="0 0 18 18" style="width: 24px !important; height: 24px !important; display: block;"><circle cx="9" cy="5" r="4" fill="#ef4444" stroke="#ffffff" stroke-width="1.5"/><line x1="9" y1="5" x2="9" y2="18" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/></svg>`;
  div.appendChild(layerEndo);
  
  const layerImplante = document.createElement('div');
  layerImplante.className = 'tooth-layer-implante';
  layerImplante.style.cssText = 'position: absolute; top: auto; bottom: 6px; left: 50%; margin-left: -10px; width: 20px; height: 26px; pointer-events: none; z-index: 10; filter: drop-shadow(0 1px 2px rgba(0,0,0,0.5)); display: block;';
  layerImplante.innerHTML = `<svg viewBox="0 0 14 18" style="width: 20px !important; height: 26px !important; display: block;"><rect x="3" y="0" width="8" height="3" fill="#94a3b8" rx="1"/><polygon points="4,3 10,3 8,16 6,16" fill="#94a3b8"/><line x1="3" y1="6" x2="11" y2="6" stroke="#475569" stroke-width="1.5"/><line x1="4" y1="9" x2="10" y2="9" stroke="#475569" stroke-width="1.5"/><line x1="4" y1="12" x2="10" y2="12" stroke="#475569" stroke-width="1.5"/></svg>`;
  div.appendChild(layerImplante);
  
  if (layerExtra) layerExtra.style.display = (toothState.wholeTooth === 'extraido' || toothState.extraido) ? 'block' : 'none';
  if (layerCorona) layerCorona.style.display = toothState.corona ? 'block' : 'none';
  if (layerEndo) layerEndo.style.display = toothState.endodoncia ? 'block' : 'none';
  if (layerImplante) layerImplante.style.display = toothState.implante ? 'block' : 'none';
  
  // Dim SVG if extracted
  const svg = div.querySelector('svg.diente-svg');
  if (svg) {
    svg.style.opacity = (toothState.wholeTooth === 'extraido' || toothState.extraido) ? '0.25' : '1';
  }
}

function applyOdontogramaColors() {
  document.querySelectorAll('.diente-svg-item').forEach(div => {
    const piezaId = div.dataset.pieza;
    div.classList.remove('selected');
    applyOdontogramaColorsToTooth(piezaId, div);
  });
}

export function initOdontogramaUI() {
  const renderRow = (containerId, pieces) => {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';
    pieces.forEach(p => {
      container.appendChild(createToothSVG(p));
    });
  };
  
  renderRow('quad-1-perm', cuadrantesDef.quad1Perm);
  renderRow('quad-1-dec',  cuadrantesDef.quad1Dec);
  renderRow('quad-2-perm', cuadrantesDef.quad2Perm);
  renderRow('quad-2-dec',  cuadrantesDef.quad2Dec);
  renderRow('quad-4-dec',  cuadrantesDef.quad4Dec);
  renderRow('quad-4-perm', cuadrantesDef.quad4Perm);
  renderRow('quad-3-dec',  cuadrantesDef.quad3Dec);
  renderRow('quad-3-perm', cuadrantesDef.quad3Perm);
  
  initOdontogramaToolbar();
}

function initOdontogramaToolbar() {
  document.querySelectorAll('.tool-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Remove active from all
      document.querySelectorAll('.tool-btn').forEach(b => b.classList.remove('active'));
      // Add active to clicked
      e.currentTarget.classList.add('active');
      // Set active tool
      state.activeOdontogramaTool = e.currentTarget.dataset.tool;
    });
  });
}



function toggleFichaEditControls(isDoctor) {
  const roleText = dom.profileRole ? dom.profileRole.textContent.trim().toLowerCase() : '';
  const isReceptionist = roleText === 'recepcionista';
  const canEdit = isDoctor || isReceptionist;

  const inputs = [
    dom.fichaNroVal, dom.fichaProfesion, dom.fichaFnac, dom.fichaEdad, 
    dom.fichaSexo, dom.fichaDomicilio, dom.fichaCiudad, 
    dom.fichaExamenExtra, dom.fichaDiagnostico
  ];
  
  inputs.forEach(inp => {
    if (canEdit) {
      inp?.removeAttribute('disabled');
    } else {
      inp?.setAttribute('disabled', '');
    }
  });
  
  if (canEdit) {
    dom.btnSaveFichaDetails?.removeAttribute('hidden');
    dom.fichaEvolucionForm?.removeAttribute('hidden');
  } else {
    dom.btnSaveFichaDetails?.setAttribute('hidden', '');
    dom.fichaEvolucionForm?.setAttribute('hidden', '');
  }

  if (isDoctor) {
    dom.btnResetOdontograma?.removeAttribute('hidden');
  } else {
    dom.btnResetOdontograma?.setAttribute('hidden', '');
  }
}

function updateDebtBanner(saldoTotal) {
  if (saldoTotal > 0) {
    if (dom.fichaDebtText) dom.fichaDebtText.textContent = `Paciente con Saldo Pendiente: ${parseFloat(saldoTotal).toFixed(2)} Bs.`;
    showAlertEl(dom.fichaDebtBanner);
  } else {
    hideAlertEl(dom.fichaDebtBanner);
  }
}

function renderEvolucionTable(evolution) {
  if (!dom.fichaEvolucionTableBody) return;
  dom.fichaEvolucionTableBody.innerHTML = '';
  
  const displayRows = state.filteredToothId ? evolution.filter(row => row.diente_nro === state.filteredToothId) : evolution;
  
  if (displayRows.length === 0) {
    dom.fichaEvolucionTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay evoluciones de tratamiento registradas.</td>
      </tr>
    `;
    return;
  }
  
  const roleRaw = dom.profileRole ? dom.profileRole.textContent.trim().toLowerCase() : '';
  const isDoctor = roleRaw === 'odontologo';
  const isReceptionist = roleRaw === 'recepcionista';
  const canDelete = isDoctor || isReceptionist;
  
  displayRows.forEach(row => {
    const tr = document.createElement('tr');
    
    const debeVal = row.debe > 0 ? parseFloat(row.debe).toFixed(2) : '-';
    const haberVal = row.haber > 0 ? parseFloat(row.haber).toFixed(2) : '-';
    const saldoVal = parseFloat(row.saldo).toFixed(2);
    
    const saldoClass = row.saldo > 0 ? 'color: var(--danger); font-weight: 700;' : 'color: var(--text-secondary);';
    
    tr.innerHTML = `
      <td style="padding: 12px 14px;">${escapeHtml(row.fecha)}</td>
      <td style="padding: 12px 14px; font-weight: 600;">${row.diente_nro || '-'}</td>
      <td style="padding: 12px 14px;">${escapeHtml(row.rx || '-')}</td>
      <td style="padding: 12px 14px; color: var(--text-primary);">${escapeHtml(row.trabajo_realizado)}</td>
      <td style="padding: 12px 14px; text-align: right; color: var(--danger); font-weight: 500;">${debeVal}</td>
      <td style="padding: 12px 14px; text-align: right; color: var(--success); font-weight: 500;">${haberVal}</td>
      <td style="padding: 12px 14px; text-align: right; ${saldoClass}">${saldoVal}</td>
      <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
        ${canDelete ? `
          <button type="button" class="btn-delete-evo" data-id="${row.id}" title="Eliminar registro">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              <line x1="10" y1="11" x2="10" y2="17"/>
              <line x1="14" y1="11" x2="14" y2="17"/>
            </svg>
          </button>
        ` : ''}
      </td>
    `;
    
    dom.fichaEvolucionTableBody.appendChild(tr);
  });
}

async function reloadFichaData() {
  if (!activeFichaPatientId) return;
  try {
    const res = await api.getFichaClinica(activeFichaPatientId);
    if (!res.ok) throw new Error('Error al recargar los datos de la ficha.');
    
    const data = await res.json();
    state.activeFichaEvolution = data.evolution || [];
    renderEvolucionTable(state.activeFichaEvolution);
    updateDebtBanner(data.saldoTotal || 0);
  } catch (err) {
    console.error(err);
  }
}

function imprimirRecibo(row) {
  const doctorName = dom.profileName ? dom.profileName.textContent.trim() : 'Dr. Cristo Rey';
  
  const debeVal = row.debe > 0 ? parseFloat(row.debe).toFixed(2) : '0.00';
  const haberVal = row.haber > 0 ? parseFloat(row.haber).toFixed(2) : '0.00';
  const saldoVal = parseFloat(row.saldo).toFixed(2);
  
  const concepto = row.trabajo_realizado || 'Tratamiento Odontológico';
  const fechaRecibo = row.fecha;
  const nroRecibo = String(row.id).padStart(6, '0');
  
  const esPago = row.haber > 0;
  const tipoDocumento = esPago ? 'Recibo de Pago' : 'Comprobante de Tratamiento';
  const colorDocumento = esPago ? '#0d9488' : '#0284c7'; // teal for payment, blue for treatment

  const printContent = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>${tipoDocumento} #${nroRecibo}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
        
        body {
          font-family: 'Inter', sans-serif;
          color: #1e293b;
          margin: 0;
          padding: 40px;
          background: #ffffff;
          font-size: 14px;
          line-height: 1.5;
        }
        
        .receipt-container {
          max-width: 650px;
          margin: 0 auto;
          border: 1px solid #e2e8f0;
          padding: 30px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03);
          position: relative;
        }

        .watermark {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%) rotate(-30deg);
          font-size: 70px;
          font-weight: 800;
          color: rgba(241, 245, 249, 0.7);
          z-index: 0;
          pointer-events: none;
          white-space: nowrap;
          text-transform: uppercase;
        }

        .receipt-content {
          position: relative;
          z-index: 1;
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 20px;
          margin-bottom: 25px;
        }
        
        .clinic-info h1 {
          font-size: 18px;
          font-weight: 700;
          margin: 0 0 5px 0;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        
        .clinic-info p {
          margin: 2px 0;
          color: #64748b;
          font-size: 12px;
        }
        
        .receipt-title {
          text-align: right;
        }
        
        .receipt-title h2 {
          font-size: 16px;
          font-weight: 700;
          margin: 0 0 5px 0;
          color: ${colorDocumento};
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        
        .receipt-title p {
          margin: 0;
          font-weight: 600;
          color: #334155;
        }

        .receipt-title span {
          display: block;
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }

        .meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          background: #f8fafc;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 25px;
          border: 1px solid #f1f5f9;
        }
        
        .meta-item p {
          margin: 3px 0;
          font-size: 13px;
        }
        
        .meta-item strong {
          color: #475569;
          font-weight: 600;
        }
        
        .table-title {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .concept-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 30px;
        }
        
        .concept-table th {
          background: #0f172a;
          color: #ffffff;
          font-weight: 600;
          text-align: left;
          padding: 10px 14px;
          font-size: 11px;
          text-transform: uppercase;
        }
        
        .concept-table td {
          padding: 14px;
          border-bottom: 1px solid #e2e8f0;
        }
        
        .concept-desc {
          font-weight: 500;
          color: #1e293b;
        }

        .concept-detail {
          font-size: 11px;
          color: #64748b;
          margin-top: 4px;
        }

        .totals-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 40px;
        }
        
        .totals-box {
          width: 250px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px;
        }
        
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 0;
          font-size: 13px;
        }

        .total-row.border-top {
          border-top: 1px dashed #e2e8f0;
          margin-top: 6px;
          padding-top: 8px;
        }

        .total-row.highlight {
          font-weight: 700;
          color: #0f172a;
          font-size: 15px;
        }
        
        .total-row.highlight .amount {
          color: #0d9488;
        }

        .total-row.debt {
          color: #e11d48;
        }

        .total-row.debt .amount {
          font-weight: 700;
        }

        .footer {
          margin-top: 60px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }
        
        .signature-area {
          text-align: center;
          width: 200px;
        }
        
        .signature-line {
          border-top: 1px solid #94a3b8;
          margin-bottom: 8px;
        }
        
        .signature-area p {
          margin: 0;
          font-size: 12px;
          color: #475569;
        }

        .receipt-note {
          font-size: 11px;
          color: #94a3b8;
          max-width: 320px;
          line-height: 1.4;
        }

        @media print {
          body {
            padding: 0;
            background: none;
          }
          .receipt-container {
            border: none;
            box-shadow: none;
            padding: 10px;
            max-width: 100%;
          }
          @page {
            margin: 1.5cm;
          }
        }
      </style>
    </head>
    <body>
      <div class="receipt-container">
        <div class="watermark">Cristo Rey</div>
        <div class="receipt-content">
          <div class="header">
            <div class="clinic-info">
              <h1>Consultorio Odontológico "Cristo Rey"</h1>
              <p>Dr. Luis D. Reynaga Padilla - Odontólogo</p>
              <p>Dirección: Av. Principal Esq. Calle 4 #123</p>
              <p>Teléfonos: 76543210 - 3345678</p>
            </div>
            <div class="receipt-title">
              <h2>${tipoDocumento}</h2>
              <p>Nº ${nroRecibo}</p>
              <span>Fecha de emisión: ${fechaRecibo}</span>
            </div>
          </div>
          
          <div class="table-title">Detalles del Paciente</div>
          <div class="meta-grid">
            <div class="meta-item">
              <p><strong>Paciente:</strong> ${activeFichaPatientName}</p>
              <p><strong>C.I. / Documento:</strong> ${activeFichaPatientCI}</p>
            </div>
            <div class="meta-item">
              <p><strong>Ficha Clínica Nº:</strong> ${dom.fichaNroVal ? dom.fichaNroVal.value || '-' : '-'}</p>
              <p><strong>Atendido por:</strong> ${doctorName}</p>
            </div>
          </div>
          
          <div class="table-title">Concepto del Servicio</div>
          <table class="concept-table">
            <thead>
              <tr>
                <th style="width: 70%">Descripción del Trabajo Realizado</th>
                <th style="text-align: right; width: 30%">Monto</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <div class="concept-desc">${concepto}</div>
                  ${row.diente_nro ? `<div class="concept-detail">Pieza Dental: Diente Nº ${row.diente_nro}</div>` : ''}
                  ${row.rx ? `<div class="concept-detail">Registro Rx: ${row.rx}</div>` : ''}
                </td>
                <td style="text-align: right; font-weight: 500;">
                  ${esPago ? `${haberVal} Bs.` : `${debeVal} Bs.`}
                </td>
              </tr>
            </tbody>
          </table>
          
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row">
                <span>Costo Tratamiento:</span>
                <span class="amount">${debeVal} Bs.</span>
              </div>
              <div class="total-row">
                <span>Monto Cancelado:</span>
                <span class="amount">${haberVal} Bs.</span>
              </div>
              <div class="total-row border-top highlight">
                <span>Total Operación:</span>
                <span class="amount">${esPago ? haberVal : debeVal} Bs.</span>
              </div>
              <div class="total-row debt">
                <span>Saldo Pendiente:</span>
                <span class="amount">${saldoVal} Bs.</span>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <div class="receipt-note">
              * Este documento es un comprobante de control interno emitido por el consultorio dental como constancia de la evolución y los pagos de tratamientos.
            </div>
            <div class="signature-area">
              <div class="signature-line"></div>
              <p>Firma Autorizada</p>
              <p style="font-size: 10px; color: #94a3b8; margin-top: 2px;">Consultorio Cristo Rey</p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  let printFrame = document.getElementById('receipt-print-iframe');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'receipt-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.bottom = '0';
    printFrame.style.right = '0';
    printFrame.style.width = '0';
    printFrame.style.height = '0';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(printContent);
  frameDoc.close();

  setTimeout(() => {
    printFrame.contentWindow.focus();
    printFrame.contentWindow.print();
  }, 350);
}

let activeAttachmentsList = [];

function openAttachmentViewer(att) {
  const modal = document.getElementById('modal-image-viewer');
  if (!modal) return;

  const titleEl = document.getElementById('image-viewer-title');
  const subEl = document.getElementById('image-viewer-subtitle');
  const imgEl = document.getElementById('image-viewer-img');
  const pdfEl = document.getElementById('image-viewer-pdf');
  const downloadLink = document.getElementById('image-viewer-download');

  if (titleEl) titleEl.textContent = att.file_name || 'Vista de Radiografía';
  if (subEl) subEl.textContent = att.description ? `Descripción: ${att.description}` : 'Radiografía / Documento del Paciente';

  const isImg = (att.mime_type && att.mime_type.startsWith('image/')) || (att.file_path && (att.file_path.startsWith('data:image/') || /\.(jpe?g|png|gif|webp|jfif|bmp|svg)$/i.test(att.file_name || att.file_path)));

  if (isImg) {
    if (pdfEl) pdfEl.hidden = true;
    if (imgEl) {
      imgEl.src = att.file_path;
      imgEl.hidden = false;
    }
  } else {
    if (imgEl) imgEl.hidden = true;
    if (pdfEl) {
      pdfEl.src = att.file_path;
      pdfEl.hidden = false;
    }
  }

  if (downloadLink) {
    downloadLink.href = att.file_path;
    downloadLink.download = att.file_name || 'radiografia';
  }

  modal.style.zIndex = '2000000';
  openModalEl(modal);
}

async function loadAndRenderAttachments(patientId) {
  if (!dom.fichaAttachmentsList) return;

  dom.fichaAttachmentsList.innerHTML = `
    <p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-size: 13px; padding: 30px 0;">
      <span class="spinner" style="border-width: 2px; width: 16px; height: 16px; border-color: rgba(255,255,255,0.1); border-top-color: var(--primary); display: inline-block;"></span>
      <span style="margin-left: 8px; vertical-align: middle;">Cargando archivos adjuntos...</span>
    </p>
  `;

  try {
    const res = await api.getAttachments(patientId);
    if (!res.ok) throw new Error('Error al cargar archivos adjuntos.');
    const data = await res.json();
    
    const attachments = data.attachments || [];
    activeAttachmentsList = attachments;
    
    dom.fichaAttachmentsList.innerHTML = '';

    if (attachments.length === 0) {
      dom.fichaAttachmentsList.innerHTML = `
        <p style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); font-style: italic; font-size: 13px; padding: 40px 0; margin: 0; width: 100%;">No hay archivos adjuntos en esta ficha.</p>
      `;
      return;
    }

    attachments.forEach(att => {
      const isImg = (att.mime_type && att.mime_type.startsWith('image/')) || (att.file_path && (att.file_path.startsWith('data:image/') || /\.(jpe?g|png|gif|webp|jfif|bmp|svg)$/i.test(att.file_name || att.file_path)));
      const card = document.createElement('div');
      card.className = 'attachment-card-item';
      
      let previewHTML = '';
      if (isImg) {
        previewHTML = `
          <div class="attachment-thumbnail-wrapper" style="cursor: pointer;" title="Hacer clic para ampliar radiografía">
            <img src="${att.file_path}" class="attachment-thumbnail" alt="${escapeHtml(att.file_name)}">
          </div>
        `;
      } else {
        previewHTML = `
          <div class="attachment-thumbnail-wrapper" style="cursor: pointer;" title="Hacer clic para ver documento">
            <div class="attachment-icon-doc">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <span>PDF</span>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        ${previewHTML}
        <div class="attachment-filename" title="${escapeHtml(att.file_name)}">${escapeHtml(att.file_name)}</div>
        <div class="attachment-desc" title="${escapeHtml(att.description || '')}">${escapeHtml(att.description || '-')}</div>
        <div class="attachment-actions-bar">
          <button type="button" class="btn-attach-action view btn-view-attachment" data-id="${att.id}" title="Ver Radiografía / Ampliar">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button type="button" class="btn-attach-action delete" data-id="${att.id}" title="Eliminar archivo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      `;
      
      const thumb = card.querySelector('.attachment-thumbnail-wrapper');
      const viewBtn = card.querySelector('.btn-view-attachment');
      const handler = (e) => {
        if (e) {
          e.preventDefault();
          e.stopPropagation();
        }
        openAttachmentViewer(att);
      };
      thumb?.addEventListener('click', handler);
      viewBtn?.addEventListener('click', handler);
      
      dom.fichaAttachmentsList.appendChild(card);
    });
  } catch (err) {
    console.error('Error al cargar adjuntos:', err);
    if (dom.fichaAttachmentsList) {
      dom.fichaAttachmentsList.innerHTML = `
        <p style="grid-column: 1 / -1; text-align: center; color: var(--danger); font-size: 13px; padding: 20px 0;">Error al cargar los archivos.</p>
      `;
    }
  }
}

export async function openFichaModal(patientId, name, ci) {
  if (!dom.fichaClinicaModal) return;
  
  activeFichaPatientId = patientId;
  activeFichaPatientName = name;
  activeFichaPatientCI = ci;
  
  hideAlertEl(dom.fichaAlert);
  hideAlertEl(dom.fichaDebtBanner);
  dom.fichaDetailsForm?.reset();
  dom.fichaEvolucionForm?.reset();
  dom.fichaAttachmentsForm?.reset();
  
  if (dom.fichaModalSubtitle) dom.fichaModalSubtitle.textContent = `Paciente: ${name} | CI: ${ci}`;
  
  if (dom.evoFecha) {
    dom.evoFecha.value = new Date().toISOString().split('T')[0];
  }
  
  const roleText = dom.profileRole ? dom.profileRole.textContent.trim().toLowerCase() : '';
  const isDoctor = roleText === 'odontologo';
  toggleFichaEditControls(isDoctor);
  
  if (dom.fichaEvolucionTableBody) {
    dom.fichaEvolucionTableBody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; padding: 20px;">
          <span class="spinner" style="border-width: 2px; width: 18px; height: 18px; border-color: rgba(255,255,255,0.1); border-top-color: var(--primary); display: inline-block;"></span>
          <span style="margin-left: 8px; vertical-align: middle; color: var(--text-muted);">Cargando ficha del paciente...</span>
        </td>
      </tr>
    `;
  }
  
  openModalEl(dom.fichaClinicaModal);

  // Cargar y actualizar membrete institucional
  try {
    const profRes = await api.getClinicProfile();
    if (profRes.ok) {
      const prof = await profRes.json();
      const printTitle = document.getElementById('ficha-print-header-title');
      const printSlogan = document.getElementById('ficha-print-header-slogan');
      const printDetails = document.getElementById('ficha-print-header-details');

      if (printTitle && prof.name) printTitle.textContent = prof.name;
      if (printSlogan && prof.slogan) printSlogan.textContent = prof.slogan;
      if (printDetails) {
        printDetails.textContent = `${prof.address || ''} • Tel: ${prof.phone || ''}${prof.nit ? ` • NIT: ${prof.nit}` : ''}`;
      }
    }
  } catch (e) {
    console.error('Error al sincronizar membrete de ficha:', e);
  }
  
  try {
    const res = await api.getFichaClinica(patientId);
    if (!res.ok) {
      throw new Error('Error al cargar la ficha clínica del paciente.');
    }
    
    const data = await res.json();
    const pat = data.patient || {};
    
    if (dom.fichaNroVal) dom.fichaNroVal.value = pat.ficha_nro || '';
    if (dom.fichaProfesion) dom.fichaProfesion.value = pat.profesion_ocupacion || '';
    if (dom.fichaFnac) dom.fichaFnac.value = pat.fecha_nacimiento || '';
    if (dom.fichaEdad) dom.fichaEdad.value = pat.edad || '';
    if (dom.fichaSexo) dom.fichaSexo.value = pat.sexo || '';
    if (dom.fichaDomicilio) dom.fichaDomicilio.value = pat.domicilio || '';
    if (dom.fichaCiudad) dom.fichaCiudad.value = pat.ciudad_localidad || '';
    if (dom.fichaExamenExtra) dom.fichaExamenExtra.value = pat.examen_extraoral || '';
    if (dom.fichaDiagnostico) dom.fichaDiagnostico.value = pat.diagnostico_presuntivo || '';
    
    try {
      state.currentOdontogramaState = pat.odontograma ? JSON.parse(pat.odontograma) : {};
    } catch (e) {
      state.currentOdontogramaState = {};
    }
    
    // Reset filters
    state.filteredToothId = null;
    if (dom.fichaFilterBadge) dom.fichaFilterBadge.style.display = 'none';
    
    applyOdontogramaColors();
    state.activeFichaEvolution = data.evolution || [];
    renderEvolucionTable(state.activeFichaEvolution);
    updateDebtBanner(data.saldoTotal || 0);
    
    // Cargar y renderizar archivos adjuntos
    await loadAndRenderAttachments(patientId);
    
  } catch (err) {
    console.error(err);
    if (dom.fichaAlertText) dom.fichaAlertText.textContent = err.message;
    showAlertEl(dom.fichaAlert);
  }
}

export async function saveActiveFichaDetailsSilent() {
  if (!activeFichaPatientId) return;

  const roleText = dom.profileRole ? dom.profileRole.textContent.trim().toLowerCase() : '';
  if (roleText !== 'odontologo') return;

  const bodyData = {
    ficha_nro: dom.fichaNroVal?.value ? parseInt(dom.fichaNroVal.value) : null,
    profesion_ocupacion: dom.fichaProfesion?.value.trim() || null,
    fecha_nacimiento: dom.fichaFnac?.value || null,
    edad: dom.fichaEdad?.value ? parseInt(dom.fichaEdad.value) : null,
    sexo: dom.fichaSexo?.value || null,
    domicilio: dom.fichaDomicilio?.value.trim() || null,
    ciudad_localidad: dom.fichaCiudad?.value.trim() || null,
    examen_extraoral: dom.fichaExamenExtra?.value.trim() || null,
    diagnostico_presuntivo: dom.fichaDiagnostico?.value.trim() || null,
    odontograma: JSON.stringify(state.currentOdontogramaState || {})
  };

  try {
    await api.saveFichaDetails(activeFichaPatientId, bodyData);
  } catch (err) {
    console.error('Error en autoguardado de ficha clínica:', err);
  }
}

let fichaHandlersInitialized = false;

export function setupFichaHandlers() {
  if (fichaHandlersInitialized) return;
  fichaHandlersInitialized = true;

  // Clinical History Modal Events
  dom.btnCloseClinicalModal?.addEventListener('click', closeClinicalModal);
  dom.btnCancelClinical?.addEventListener('click', closeClinicalModal);
  dom.clinicalModal?.addEventListener('click', (e) => {
    if (e.target === dom.clinicalModal) closeClinicalModal();
  });

  dom.clinicalObservations?.addEventListener('input', () => {
    const errEl = document.getElementById('clinical-observations-error');
    if (errEl) errEl.textContent = '';
    dom.clinicalObservations.style.borderColor = '';
    hideClinicalAlert();
  });

  // Autocompletado de tratamientos en Ficha Clínica (campo evo-trabajo)
  // Se inicializa de forma diferida al primer submit o al abrir la ficha
  initTreatmentAutocomplete('evo-trabajo', 'evo-trabajo-suggestions', (treatment) => {
    // Al seleccionar un tratamiento, rellenar automáticamente el costo base en evo-debe
    if (dom.evoDebe) {
      dom.evoDebe.value = parseFloat(treatment.costo_base).toFixed(2);
    }
  });

  dom.clinicalForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideClinicalAlert();

    const observaciones = dom.clinicalObservations.value.trim();
    if (!observaciones) {
      const errEl = document.getElementById('clinical-observations-error');
      if (errEl) errEl.textContent = 'Las observaciones clínicas son obligatorias.';
      dom.clinicalObservations.style.borderColor = 'var(--danger)';
      return;
    }

    const checkedInputs = dom.clinicalTreatmentsList.querySelectorAll('input[name="treatment"]:checked');
    const tratamiento_ids = Array.from(checkedInputs).map(input => parseInt(input.value));

    setClinicalLoading(true);
    try {
      const res = await api.saveClinicalHistory(state.activeClinicalApptId, observaciones, tratamiento_ids);
      const data = await res.json();
      setClinicalLoading(false);

      if (!res.ok) {
        showClinicalAlert(data.error || 'Error al guardar el historial clínico.');
        showToast(data.error || 'Error al guardar el historial clínico.', 'error');
        return;
      }

      closeClinicalModal();
      showToast('Historial clínico guardado con éxito.', 'success');
      // Recargar citas del día para refrescar la agenda
      if (window.loadAppointments && typeof window.loadAppointments === 'function') {
        await window.loadAppointments();
      }
    } catch (err) {
      setClinicalLoading(false);
      showToast('Error de conexión con el servidor.', 'error');
    }
  });



  // Ficha Clinica Modal Events
  const closeFichaWithAutoSave = async () => {
    await saveActiveFichaDetailsSilent();
    closeModalEl(dom.fichaClinicaModal);
  };

  dom.btnCloseFichaModal?.addEventListener('click', closeFichaWithAutoSave);
  dom.btnCloseFichaFooter?.addEventListener('click', closeFichaWithAutoSave);
  dom.fichaClinicaModal?.addEventListener('click', (e) => {
    if (e.target === dom.fichaClinicaModal) closeFichaWithAutoSave();
  });

  dom.btnPrintFicha?.addEventListener('click', () => {
    window.print();
  });

  dom.btnSuggestFichaNro?.addEventListener('click', async () => {
    try {
      const res = await api.getSuggestFichaNro();
      if (!res.ok) throw new Error('Error al obtener sugerencia de número de ficha.');
      const data = await res.json();
      if (dom.fichaNroVal && data.nextFichaNro) {
        dom.fichaNroVal.value = data.nextFichaNro;
        showToast('Número de ficha sugerido con éxito.', 'success');
      }
    } catch (err) {
      console.error(err);
      showToast('No se pudo sugerir el número de ficha.', 'error');
    }
  });

  dom.btnClearFichaFilter?.addEventListener('click', () => {
    state.filteredToothId = null;
    document.querySelectorAll('.diente-svg-item').forEach(el => el.classList.remove('selected'));
    if (dom.fichaFilterBadge) dom.fichaFilterBadge.style.display = 'none';
    renderEvolucionTable(state.activeFichaEvolution);
  });
  
  dom.btnResetOdontograma?.addEventListener('click', async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    state.currentOdontogramaState = {};
    applyOdontogramaColors();
    await saveActiveFichaDetailsSilent();
    showToast('Odontograma restaurado.', 'success');
  });

  // Save Ficha General details
  dom.fichaDetailsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    hideAlertEl(dom.fichaAlert);
    dom.fichaSaveSpinner?.removeAttribute('hidden');
    dom.btnSaveFichaDetails?.setAttribute('disabled', '');
    
    const bodyData = {
      ficha_nro: dom.fichaNroVal.value ? parseInt(dom.fichaNroVal.value) : null,
      profesion_ocupacion: dom.fichaProfesion.value.trim() || null,
      fecha_nacimiento: dom.fichaFnac.value || null,
      edad: dom.fichaEdad.value ? parseInt(dom.fichaEdad.value) : null,
      sexo: dom.fichaSexo.value || null,
      domicilio: dom.fichaDomicilio.value.trim() || null,
      ciudad_localidad: dom.fichaCiudad.value.trim() || null,
      examen_extraoral: dom.fichaExamenExtra.value.trim() || null,
      diagnostico_presuntivo: dom.fichaDiagnostico.value.trim() || null,
      odontograma: JSON.stringify(state.currentOdontogramaState)
    };
    
    try {
      const res = await api.saveFichaDetails(activeFichaPatientId, bodyData);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar los datos de la ficha clínica.');
      }
      
      showToast('Ficha clínica guardada con éxito.', 'success');
      await loadPatients();
      
    } catch (err) {
      console.error(err);
      if (dom.fichaAlertText) dom.fichaAlertText.textContent = err.message;
      showAlertEl(dom.fichaAlert);
      showToast(err.message, 'error');
    } finally {
      dom.fichaSaveSpinner?.setAttribute('hidden', '');
      dom.btnSaveFichaDetails?.removeAttribute('disabled');
    }
  });

  // Add evolution record submit
  dom.fichaEvolucionForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    hideAlertEl(dom.fichaAlert);
    dom.evoSpinner?.removeAttribute('hidden');
    dom.btnAddEvo?.setAttribute('disabled', '');
    
    const bodyData = {
      fecha: dom.evoFecha.value,
      diente_nro: dom.evoDiente.value ? parseInt(dom.evoDiente.value) : null,
      rx: dom.evoRx.value.trim() || null,
      trabajo_realizado: dom.evoTrabajo.value.trim(),
      debe: parseFloat(dom.evoDebe.value) || 0.00,
      haber: parseFloat(dom.evoHaber.value) || 0.00
    };
    
    try {
      const res = await api.addEvolucion(activeFichaPatientId, bodyData);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al agregar registro de evolución.');
      }
      
      showToast('Evolución de tratamiento agregada con éxito.', 'success');
      
      const savedDate = dom.evoFecha.value;
      dom.fichaEvolucionForm.reset();
      dom.evoFecha.value = savedDate;
      
      document.querySelectorAll('.diente-svg-item').forEach(el => el.classList.remove('selected'));
      await reloadFichaData();
      
    } catch (err) {
      console.error(err);
      if (dom.fichaAlertText) dom.fichaAlertText.textContent = err.message;
      showAlertEl(dom.fichaAlert);
      showToast(err.message, 'error');
    } finally {
      dom.evoSpinner?.setAttribute('hidden', '');
      dom.btnAddEvo?.removeAttribute('disabled');
    }
  });

  // Delete evolution record click delegation
  dom.fichaEvolucionTableBody?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-delete-evo');
    if (!btn) return;
    
    const rowId = btn.dataset.id;
    showConfirmModal(
      '¿Eliminar Registro de Evolución?',
      '¿Está seguro de que desea eliminar este registro de evolución? El saldo histórico posterior será recalculado automáticamente.',
      true,
      async () => {
        dom.fichaAlert?.setAttribute('hidden', '');
        
        try {
          const res = await api.deleteEvolucion(rowId);
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Error al eliminar el registro.');
          }
          
          showToast('Registro de evolución eliminado con éxito.', 'success');
          await reloadFichaData();
          
        } catch (err) {
          console.error(err);
          showToast(err.message, 'error');
        }
      }
    );
  });

  // Print evolution receipt click delegation
  dom.fichaEvolucionTableBody?.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-print-receipt');
    if (!btn) return;
    
    const rowId = btn.dataset.id;
    const row = state.activeFichaEvolution.find(r => r.id == rowId);
    if (!row) {
      showToast('No se encontró el registro de evolución seleccionado.', 'error');
      return;
    }
    
    imprimirRecibo(row);
  });

  let isUploadingAttachment = false;

  // Manejo de la subida de archivos adjuntos (Base64)
  dom.fichaAttachmentsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isUploadingAttachment) return;

    const fileInput = dom.attachFile;
    if (!fileInput || fileInput.files.length === 0) {
      showToast('Por favor, seleccione un archivo.', 'error');
      return;
    }

    isUploadingAttachment = true;
    dom.attachSpinner?.removeAttribute('hidden');
    dom.btnAddAttachment?.setAttribute('disabled', '');

    const description = dom.attachDescription.value.trim();
    const file = fileInput.files[0];

    // Leer el archivo como Base64 Data URI
    const reader = new FileReader();
    reader.onload = async () => {
      const fileData = reader.result;

      try {
        const res = await api.uploadAttachment(activeFichaPatientId, {
          filename: file.name,
          fileData,
          description
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Error al subir el archivo.');
        }

        showToast('Archivo adjunto subido con éxito.', 'success');
        dom.fichaAttachmentsForm.reset();
        await loadAndRenderAttachments(activeFichaPatientId);
      } catch (err) {
        console.error(err);
        showToast(err.message, 'error');
      } finally {
        isUploadingAttachment = false;
        dom.attachSpinner?.setAttribute('hidden', '');
        dom.btnAddAttachment?.removeAttribute('disabled');
      }
    };

    reader.onerror = () => {
      isUploadingAttachment = false;
      dom.attachSpinner?.setAttribute('hidden', '');
      dom.btnAddAttachment?.removeAttribute('disabled');
      showToast('Error al leer el archivo.', 'error');
    };

    reader.readAsDataURL(file);
  });

  // Delegación de eventos para eliminar archivos adjuntos
  dom.fichaAttachmentsList?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-attach-action.delete');
    if (!btn) return;

    const attachmentId = btn.dataset.id;
    showConfirmModal(
      '¿Eliminar Archivo Adjunto?',
      '¿Está seguro de que desea eliminar este archivo adjunto / radiografía? Esta acción no se puede deshacer.',
      true,
      async () => {
        try {
          const res = await api.deleteAttachment(attachmentId);
          const data = await res.json();
          
          if (!res.ok) {
            throw new Error(data.error || 'Error al eliminar el archivo.');
          }

          showToast('Archivo adjunto eliminado con éxito.', 'success');
          await loadAndRenderAttachments(activeFichaPatientId);
        } catch (err) {
          console.error(err);
          showToast(err.message, 'error');
        }
      }
    );
  });

  // Eventos para cerrar el visor de imágenes/radiografías
  const modalViewer = document.getElementById('modal-image-viewer');
  ['btn-close-image-viewer', 'btn-close-image-viewer-footer'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => closeModalEl(modalViewer));
  });
  modalViewer?.addEventListener('click', (e) => {
    if (e.target === modalViewer) closeModalEl(modalViewer);
  });

  // Open Ficha from patient card clicks (delegated)
  dom.patientCardsContainer?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-view-ficha');
    if (!btn) return;
    
    const patientId = btn.dataset.id;
    const name = btn.dataset.name;
    const ci = btn.dataset.ci;
    
    await openFichaModal(patientId, name, ci);
  });
}
