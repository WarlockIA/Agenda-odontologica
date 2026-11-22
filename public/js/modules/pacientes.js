// pacientes.js — Gestión de Pacientes, Autocompletado y Línea de Tiempo
import { dom } from './dom.js';
import { state } from './state.js';
import { api } from './api.js';
import { openModalEl, closeModalEl, showToast, showAlertEl, hideAlertEl } from './ui.js';
import { escapeHtml, debounce, validateBolivianPhone, formatPhoneInput } from './utils.js';

let allPatients = [];

export async function loadPatients() {
  if (!dom.patientCardsContainer) return;

  try {
    const data = await api.getPatients();
    allPatients = data.patients || [];

    // Actualizar Tarjetas KPI de Pacientes
    const kpiTotal = document.getElementById('kpi-total-patients');
    const kpiMonth = document.getElementById('kpi-month-patients');
    const kpiActive = document.getElementById('kpi-active-fichas');

    if (kpiTotal) kpiTotal.textContent = allPatients.length;
    if (kpiMonth) {
      const now = new Date();
      const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const monthCount = allPatients.filter(p => p.created_at && p.created_at.startsWith(currentYearMonth)).length;
      kpiMonth.textContent = monthCount;
    }
    if (kpiActive) {
      kpiActive.textContent = allPatients.length;
    }
    
    // Si hay un término de búsqueda, mostrar los filtrados; si no, mostrar todos
    const query = dom.searchPatientsInput ? dom.searchPatientsInput.value.toLowerCase().trim() : '';
    if (query) {
      const filtered = allPatients.filter(pat => 
        pat.nombre_completo.toLowerCase().includes(query) || 
        pat.ci.toLowerCase().includes(query)
      );
      renderPatientsList(filtered);
    } else {
      renderPatientsList(allPatients);
    }
  } catch (err) {
    console.error(err.message);
    dom.patientCardsContainer.innerHTML = `
      <div class="empty-state">
        <p style="color: var(--danger);">Error al cargar los pacientes. Por favor, recargue la página.</p>
      </div>
    `;
  }
}

export function renderPatientsList(patients) {
  if (!dom.patientCardsContainer) return;
  dom.patientCardsContainer.innerHTML = '';

  if (patients.length === 0) {
    dom.patientCardsContainer.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 40px; height: 40px; margin-bottom: 8px;">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
        </svg>
        <p>No hay pacientes registrados aún.<br>Utilice el formulario de registro para agregar uno.</p>
      </div>
    `;
    return;
  }

  const isDoctor = dom.profileRole && dom.profileRole.textContent === 'odontologo';

  patients.forEach(pat => {
    const card = document.createElement('div');
    card.className = 'patient-card-item';
    
    card.innerHTML = `
      <div class="patient-card-header">
        <span class="patient-card-name">${escapeHtml(pat.nombre_completo)}</span>
        <span class="patient-card-ci">CI: ${escapeHtml(pat.ci)}</span>
      </div>
      <div class="patient-card-details">
        ${pat.telefono ? `
          <span class="patient-card-phone">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right: 4px; vertical-align: middle;">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            ${escapeHtml(pat.telefono)}
          </span>
        ` : ''}
      </div>
      ${pat.notas_medicas ? `
        <div class="patient-card-notes">
          <strong>Notas Médicas:</strong> ${escapeHtml(pat.notas_medicas)}
        </div>
      ` : ''}
      <div class="patient-card-actions" style="margin-top: 10px; display: flex; gap: 8px; flex-wrap: wrap;">
        ${isDoctor ? `
          <button class="btn-view-timeline" data-id="${pat.id}" data-name="${escapeHtml(pat.nombre_completo)}" data-ci="${escapeHtml(pat.ci)}" data-notes="${escapeHtml(pat.notas_medicas || '')}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Ver Línea de Tiempo
          </button>
        ` : ''}
        <button class="btn-view-ficha" data-id="${pat.id}" data-name="${escapeHtml(pat.nombre_completo)}" data-ci="${escapeHtml(pat.ci)}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <circle cx="9" cy="9" r="1"/>
          </svg>
          Ficha Clínica
        </button>
      </div>
    `;
    dom.patientCardsContainer.appendChild(card);
  });
}

// Validaciones UX y verificaciones de CI/Teléfono
function sanitizarCILocal(val) {
  return val.trim().replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

function updateFieldStatus(inputId, message, fieldState) {
  const errorEl = document.getElementById(`${inputId}-error`);
  const inputEl = document.getElementById(inputId);
  if (!errorEl || !inputEl) return;

  errorEl.textContent = message;
  
  if (fieldState === 'error') {
    errorEl.style.color = 'var(--danger)';
    inputEl.style.borderColor = 'var(--danger)';
  } else if (fieldState === 'warning') {
    errorEl.style.color = 'hsl(40, 95%, 55%)';
    inputEl.style.borderColor = 'hsl(40, 80%, 45%)';
  } else if (fieldState === 'success') {
    errorEl.style.color = 'var(--success)';
    inputEl.style.borderColor = 'var(--success)';
  } else {
    errorEl.style.color = '';
    inputEl.style.borderColor = '';
  }
}

const checkPatCiAvailability = debounce(async (ciVal) => {
  const sanitized = sanitizarCILocal(ciVal);
  if (sanitized.length < 4) {
    state.isPatCiDuplicated = false;
    return;
  }

  try {
    const data = await api.checkCiAvailability(sanitized);
    if (data.exists) {
      state.isPatCiDuplicated = true;
      updateFieldStatus('pat-ci', '⚠️ Esta Cédula de Identidad ya está registrada.', 'error');
    } else {
      state.isPatCiDuplicated = false;
      updateFieldStatus('pat-ci', '✓ Cédula de Identidad disponible.', 'success');
    }
  } catch (err) {
    console.error('Error checking patient CI:', err);
  }
}, 300);

const checkQuickPatCiAvailability = debounce(async (ciVal) => {
  const sanitized = sanitizarCILocal(ciVal);
  if (sanitized.length < 4) {
    state.isQuickPatCiDuplicated = false;
    return;
  }

  try {
    const data = await api.checkCiAvailability(sanitized);
    if (data.exists) {
      state.isQuickPatCiDuplicated = true;
      updateFieldStatus('quick-pat-ci', '⚠️ Esta Cédula de Identidad ya está registrada.', 'error');
    } else {
      state.isQuickPatCiDuplicated = false;
      updateFieldStatus('quick-pat-ci', '✓ Cédula de Identidad disponible.', 'success');
    }
  } catch (err) {
    console.error('Error checking quick patient CI:', err);
  }
}, 300);

function handlePhoneInputValidation(e, inputId, errorFlagName) {
  const formatted = formatPhoneInput(e.target.value);
  e.target.value = formatted;

  const val = formatted.trim();
  if (!val) {
    state[errorFlagName] = false;
    updateFieldStatus(inputId, '', 'none');
    return;
  }

  const validation = validateBolivianPhone(val);
  if (!validation.isValid) {
    state[errorFlagName] = true;
    updateFieldStatus(inputId, `⚠️ ${validation.message}`, 'error');
  } else {
    state[errorFlagName] = false;
    updateFieldStatus(inputId, '✓ Formato de teléfono válido.', 'success');
  }
}

function showPatientAlert(msg) {
  if (dom.patientAlertText) dom.patientAlertText.textContent = msg;
  showAlertEl(dom.patientAlert);
  dom.patientAlert?.classList.add('shake-animation');
  setTimeout(() => {
    dom.patientAlert?.classList.remove('shake-animation');
  }, 400);
}

function showPatientFieldError(id, msg) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = msg;
  if (input) input.style.borderColor = 'var(--danger)';
}

function clearPatientFieldError(id) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = '';
  if (input) input.style.borderColor = '';
}

function clearPatientFieldErrors() {
  ['pat-name', 'pat-ci', 'pat-phone'].forEach(clearPatientFieldError);
}

function setPatientLoading(isLoading) {
  const btnSubmit = dom.patientForm?.querySelector('button[type="submit"]');
  const btnText = btnSubmit?.querySelector('.btn-text');
  if (!btnSubmit) return;
  btnSubmit.disabled = isLoading;
  if (btnText) btnText.style.opacity = isLoading ? '0' : '1';
  if (dom.patSpinner) isLoading ? dom.patSpinner.removeAttribute('hidden') : dom.patSpinner.setAttribute('hidden', '');
}

// Autocomplete and Suggestions Logic
const handlePatientInput = debounce(async (e) => {
  const query = e.target.value.trim();
  
  state.selectedPatientId = null;
  
  if (query.length < 3) {
    if (dom.suggestionsDropdown) {
      dom.suggestionsDropdown.innerHTML = '';
      dom.suggestionsDropdown.setAttribute('hidden', '');
    }
    dom.btnQuickAddPatient?.setAttribute('hidden', '');
    return;
  }

  try {
    const data = await api.searchPatients(query);
    renderSuggestions(data.patients || [], query);
  } catch (err) {
    console.error('Error en autocomplete:', err);
  }
}, 300);

function renderSuggestions(patients, query) {
  if (!dom.suggestionsDropdown) return;
  dom.suggestionsDropdown.innerHTML = '';

  if (patients.length === 0) {
    dom.suggestionsDropdown.setAttribute('hidden', '');
    dom.btnQuickAddPatient?.removeAttribute('hidden');
    return;
  }

  dom.btnQuickAddPatient?.setAttribute('hidden', '');

  patients.forEach(pat => {
    const item = document.createElement('div');
    item.className = 'autocomplete-suggestion-item';
    item.innerHTML = `
      <span class="suggestion-name">${escapeHtml(pat.nombre_completo)}</span>
      <span class="suggestion-ci">CI: ${escapeHtml(pat.ci)}</span>
    `;
    
    item.addEventListener('click', () => {
      dom.apptPatientInput.value = pat.nombre_completo;
      if (dom.apptPhoneInput && pat.telefono) {
        dom.apptPhoneInput.value = pat.telefono;
        // Limpiar error del campo teléfono cita
        const phoneErr = document.getElementById('appt-phone-error');
        if (phoneErr) phoneErr.textContent = '';
        dom.apptPhoneInput.style.borderColor = '';
      }
      state.selectedPatientId = pat.id;
      dom.suggestionsDropdown.setAttribute('hidden', '');
      
      const patErr = document.getElementById('appt-patient-error');
      if (patErr) patErr.textContent = '';
      dom.apptPatientInput.style.borderColor = '';
    });

    dom.suggestionsDropdown.appendChild(item);
  });

  dom.suggestionsDropdown.removeAttribute('hidden');
}

// Quick Register Patient Logic
function showQuickPatAlert(msg) {
  if (dom.quickPatAlertText) dom.quickPatAlertText.textContent = msg;
  showAlertEl(dom.quickPatAlert);
  dom.quickPatAlert?.classList.add('shake-animation');
  setTimeout(() => {
    dom.quickPatAlert?.classList.remove('shake-animation');
  }, 400);
}

function showQuickPatFieldError(id, msg) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = msg;
  if (input) input.style.borderColor = 'var(--danger)';
}

function clearQuickPatFieldError(id) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = '';
  if (input) input.style.borderColor = '';
}

function clearQuickPatFieldErrors() {
  ['quick-pat-name', 'quick-pat-ci', 'quick-pat-phone'].forEach(clearQuickPatFieldError);
}

function setQuickPatLoading(isLoading) {
  const btnSubmit = dom.quickPatientForm?.querySelector('button[type="submit"]');
  const btnText = btnSubmit?.querySelector('.btn-text');
  if (!btnSubmit) return;
  btnSubmit.disabled = isLoading;
  if (btnText) btnText.style.opacity = isLoading ? '0' : '1';
  if (dom.quickPatSpinner) isLoading ? dom.quickPatSpinner.removeAttribute('hidden') : dom.quickPatSpinner.setAttribute('hidden', '');
}

export function closeQuickPatientModal() {
  closeModalEl(dom.quickPatientModal, () => {
    dom.quickPatientForm?.reset();
    hideAlertEl(dom.quickPatAlert);
    clearQuickPatFieldErrors();
    state.isQuickPatCiDuplicated = false;
    state.isQuickPatPhoneInvalid = false;
  });
}

// Chronological Timeline Logic
export async function openTimelineModal(patientId, name, ci, notes) {
  if (!dom.timelineModal) return;

  dom.timelineModalTitle.textContent = `Expediente Clínico: ${name}`;
  dom.timelineModalSubtitle.textContent = `CI: ${ci}`;
  
  if (notes && notes.trim()) {
    dom.timelinePatientNotesText.textContent = notes;
    dom.timelinePatientNotesContainer.removeAttribute('hidden');
  } else {
    dom.timelinePatientNotesContainer.setAttribute('hidden', '');
  }

  dom.timelineLoading.style.display = 'flex';
  hideAlertEl(dom.timelineAlert);
  dom.timelineContainer.setAttribute('hidden', '');
  dom.timelineContainer.innerHTML = '';

  openModalEl(dom.timelineModal);

  try {
    const res = await api.getChronologicalHistory(patientId);
    if (!res.ok) {
      if (res.status === 403) {
        throw new Error('Acceso denegado: rol no autorizado para esta acción.');
      }
      throw new Error('Error al cargar la línea de tiempo del paciente.');
    }

    const data = await res.json();
    renderTimeline(data.historial || []);
  } catch (err) {
    console.error(err.message);
    dom.timelineAlertText.textContent = err.message;
    showAlertEl(dom.timelineAlert);
  } finally {
    dom.timelineLoading.style.display = 'none';
  }
}

function formatTimelineDateTime(fechaStr, horaStr) {
  let dateFormatted = fechaStr || '';
  if (fechaStr && /^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim())) {
    const [yyyy, mm, dd] = fechaStr.trim().split('-');
    dateFormatted = `${dd}/${mm}/${yyyy}`;
  }
  
  const timeFormatted = (horaStr && horaStr.trim()) ? horaStr.trim() : '';
  if (timeFormatted && dateFormatted) {
    return `${timeFormatted} — ${dateFormatted}`;
  }
  return timeFormatted || dateFormatted;
}

function renderTimeline(historial) {
  dom.timelineContainer.innerHTML = '';
  dom.timelineContainer.removeAttribute('hidden');

  if (historial.length === 0) {
    dom.timelineContainer.innerHTML = `
      <div class="empty-state" style="padding: 20px 0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="width: 32px; height: 32px; margin-bottom: 6px; color: var(--text-muted);">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>No se registran citas pasadas ni historial clínico para este paciente.</p>
      </div>
    `;
    return;
  }

  historial.forEach(item => {
    const timelineItem = document.createElement('div');
    const displayDateTime = formatTimelineDateTime(item.fecha, item.hora);
    
    if (item.type === 'financial') {
      timelineItem.className = 'timeline-item timeline-item-financial';
      
      const isPayment = parseFloat(item.haber) > 0;
      const badgeIcon = isPayment
        ? `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
           </svg>`
        : `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/>
           </svg>`;
           
      const statusText = isPayment ? 'Pago (Haber)' : 'Cargo (Debe)';
      const statusClass = isPayment ? 'financial-credit' : 'financial-debit';
      
      const detailsHTML = [];
      if (item.diente_nro) detailsHTML.push(`<strong>Pieza FDI:</strong> ${item.diente_nro}`);
      if (item.rx) detailsHTML.push(`<strong>Rx:</strong> ${escapeHtml(item.rx)}`);
      
      const detailsStr = detailsHTML.length > 0
        ? `<div class="timeline-financial-details" style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">${detailsHTML.join(' | ')}</div>`
        : '';
        
      const amount = isPayment ? parseFloat(item.haber).toFixed(2) : parseFloat(item.debe).toFixed(2);
      const amountSign = isPayment ? '+' : '-';
      const amountClass = isPayment ? 'color: var(--success); font-weight: 700;' : 'color: var(--danger); font-weight: 700;';

      timelineItem.innerHTML = `
        <div class="timeline-badge timeline-badge-financial ${statusClass}">${badgeIcon}</div>
        <div class="timeline-card">
          <div class="timeline-card-header">
            <span class="timeline-date-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              ${escapeHtml(displayDateTime)}
            </span>
            <span class="timeline-status ${statusClass}">${statusText}</span>
          </div>
          <div class="timeline-financial-desc" style="font-size: 13.5px; color: var(--text-primary); margin-bottom: 8px;">
            <strong>Concepto:</strong> ${escapeHtml(item.trabajo_realizado)}
          </div>
          ${detailsStr}
          <div class="timeline-financial-footer" style="display: flex; justify-content: space-between; align-items: center; margin-top: 12px; font-size: 13px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 8px;">
            <span style="${amountClass}">Monto: ${amountSign}${amount} Bs.</span>
            <span style="color: var(--text-muted);">Saldo: ${parseFloat(item.saldo).toFixed(2)} Bs.</span>
          </div>
        </div>
      `;
      
    } else if (item.type === 'attachment') {
      timelineItem.className = 'timeline-item timeline-item-attachment';
      
      const badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
      </svg>`;
      
      const isImage = item.mime_type && item.mime_type.startsWith('image/');
      
      const previewHTML = isImage
        ? `<div class="timeline-attachment-preview-wrapper" style="margin-top: 10px; margin-bottom: 10px;">
            <a href="${item.file_path}" target="_blank" title="Ver imagen en tamaño completo">
              <img src="${item.file_path}" class="timeline-attachment-preview-img" alt="${escapeHtml(item.file_name)}" 
                   style="max-height: 80px; max-width: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); object-fit: cover; display: block; transition: transform 0.2s ease;">
            </a>
           </div>`
        : '';

      timelineItem.innerHTML = `
        <div class="timeline-badge timeline-badge-attachment">${badgeIcon}</div>
        <div class="timeline-card">
          <div class="timeline-card-header">
            <span class="timeline-date-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              ${escapeHtml(displayDateTime)}
            </span>
            <span class="timeline-status attachment-badge">Adjunto</span>
          </div>
          <div class="timeline-attachment-info" style="font-size: 13.5px; color: var(--text-primary);">
            <strong>Archivo:</strong> ${escapeHtml(item.file_name)}
          </div>
          <div class="timeline-attachment-desc" style="font-size: 12.5px; color: var(--text-secondary); margin-top: 4px; font-style: italic;">
            ${escapeHtml(item.description || 'Sin descripción.')}
          </div>
          ${previewHTML}
          <div style="margin-top: 12px; border-top: 1px dashed rgba(255,255,255,0.06); padding-top: 8px; display: flex; justify-content: flex-end;">
            <a href="${item.file_path}" target="_blank" class="timeline-attachment-download-btn"
               style="font-size: 11.5px; font-weight: 600; color: #22d3ee; text-decoration: none; display: flex; align-items: center; gap: 4px; background: rgba(34, 211, 238, 0.08); padding: 4px 10px; border-radius: 4px; border: 1px solid rgba(34, 211, 238, 0.2); transition: all 0.2s ease;">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
              Descargar / Ver
            </a>
          </div>
        </div>
      `;
      
    } else {
      timelineItem.className = 'timeline-item timeline-item-appointment';
      
      const badgeIcon = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8" y1="2" x2="8" y2="6"/>
        <line x1="3" y1="10" x2="21" y2="10"/>
      </svg>`;

      const treatmentsHTML = item.tratamientos && item.tratamientos.length > 0
        ? `<div class="timeline-treatments-title">Tratamientos Aplicados:</div>
           <ul class="timeline-treatments-list">
             ${item.tratamientos.map(t => `<li class="timeline-treatment-tag">${escapeHtml(t.nombre)}</li>`).join('')}
           </ul>`
        : '';

      const observationsHTML = item.observaciones_clinicas && item.observaciones_clinicas.trim()
        ? `<div class="timeline-observations"><strong>Observaciones:</strong> ${escapeHtml(item.observaciones_clinicas)}</div>`
        : `<div class="timeline-observations" style="color: var(--text-muted); font-style: italic;">Sin observaciones clínicas registradas.</div>`;

      const statusClass = item.estado.toLowerCase().replace(/\s+/g, '-');

      timelineItem.innerHTML = `
        <div class="timeline-badge timeline-badge-appointment">${badgeIcon}</div>
        <div class="timeline-card">
          <div class="timeline-card-header">
            <span class="timeline-date-time">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/>
                <line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              ${escapeHtml(displayDateTime)}
            </span>
            <span class="timeline-status ${statusClass}">${escapeHtml(item.estado)}</span>
          </div>
          <div class="timeline-doc-name">Tratado por: ${escapeHtml(item.odontologo_nombre)}</div>
          ${observationsHTML}
          ${treatmentsHTML}
        </div>
      `;
    }
    
    dom.timelineContainer.appendChild(timelineItem);
  });
}

// Bind all listeners
export function setupPatientHandlers() {
  // 1. Submit form paciente
  dom.patientForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    hideAlertEl(dom.patientAlert);
    hideAlertEl(dom.patientSuccess);
    clearPatientFieldErrors();

    const nameVal = document.getElementById('pat-name').value.trim();
    const phoneVal = document.getElementById('pat-phone').value.trim();
    const ciVal = document.getElementById('pat-ci').value.trim();
    const notesVal = document.getElementById('pat-notes').value.trim();

    let isValid = true;
    if (!nameVal) {
      showPatientFieldError('pat-name', 'El nombre completo del paciente es obligatorio.');
      isValid = false;
    }
    if (!ciVal) {
      showPatientFieldError('pat-ci', 'La Cédula de Identidad (CI) es obligatoria.');
      isValid = false;
    }
    if (state.isPatCiDuplicated) {
      showPatientFieldError('pat-ci', 'La Cédula de Identidad (CI) ya está registrada.');
      isValid = false;
    }
    if (state.isPatPhoneInvalid) {
      showPatientFieldError('pat-phone', 'El teléfono ingresado es inválido.');
      isValid = false;
    }

    if (!isValid) return;

    setPatientLoading(true);
    try {
      const res = await api.savePatient({
        nombre_completo: nameVal,
        telefono: phoneVal || null,
        ci: ciVal,
        notes_medicas: notesVal || null
      });

      const data = await res.json();
      setPatientLoading(false);

      if (!res.ok) {
        showPatientAlert(data.error || 'Error al guardar el paciente.');
        showToast(data.error || 'Error al guardar el paciente.', 'error');
        return;
      }

      dom.patientForm.reset();
      if (dom.searchPatientsInput) dom.searchPatientsInput.value = '';
      state.isPatCiDuplicated = false;
      state.isPatPhoneInvalid = false;
      showToast('Paciente registrado con éxito.', 'success');
      await loadPatients();

    } catch (err) {
      setPatientLoading(false);
      showToast('Error de conexión con el servidor.', 'error');
    }
  });

  // 2. Realtime input listeners
  document.getElementById('pat-name')?.addEventListener('input', () => {
    clearPatientFieldError('pat-name');
    hideAlertEl(dom.patientAlert);
  });

  document.getElementById('pat-ci')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const sanitized = sanitizarCILocal(val);
    
    e.target.value = val.toUpperCase().replace(/[^a-zA-Z0-9- ]/g, '');

    if (!sanitized) {
      state.isPatCiDuplicated = false;
      updateFieldStatus('pat-ci', 'La Cédula de Identidad (CI) es obligatoria.', 'error');
      return;
    }

    if (sanitized.length < 4) {
      state.isPatCiDuplicated = false;
      updateFieldStatus('pat-ci', 'Mínimo 4 caracteres alfanuméricos.', 'warning');
      return;
    }

    updateFieldStatus('pat-ci', 'Verificando disponibilidad...', 'warning');
    checkPatCiAvailability(val);
  });

  document.getElementById('quick-pat-ci')?.addEventListener('input', (e) => {
    const val = e.target.value;
    const sanitized = sanitizarCILocal(val);
    
    e.target.value = val.toUpperCase().replace(/[^a-zA-Z0-9- ]/g, '');

    if (!sanitized) {
      state.isQuickPatCiDuplicated = false;
      updateFieldStatus('quick-pat-ci', 'La Cédula de Identidad (CI) es obligatoria.', 'error');
      return;
    }

    if (sanitized.length < 4) {
      state.isQuickPatCiDuplicated = false;
      updateFieldStatus('quick-pat-ci', 'Mínimo 4 caracteres alfanuméricos.', 'warning');
      return;
    }

    updateFieldStatus('quick-pat-ci', 'Verificando disponibilidad...', 'warning');
    checkQuickPatCiAvailability(val);
  });

  document.getElementById('pat-phone')?.addEventListener('input', (e) => {
    handlePhoneInputValidation(e, 'pat-phone', 'isPatPhoneInvalid');
  });

  document.getElementById('quick-pat-phone')?.addEventListener('input', (e) => {
    handlePhoneInputValidation(e, 'quick-pat-phone', 'isQuickPatPhoneInvalid');
  });

  document.getElementById('appt-phone')?.addEventListener('input', (e) => {
    handlePhoneInputValidation(e, 'appt-phone', 'isApptPhoneInvalid');
  });

  // 3. Autocomplete setup
  dom.apptPatientInput?.addEventListener('input', handlePatientInput);

  // Close suggestions click outside
  document.addEventListener('click', (e) => {
    if (dom.suggestionsDropdown && !dom.suggestionsDropdown.hasAttribute('hidden') && !e.target.closest('.autocomplete-container')) {
      dom.suggestionsDropdown.setAttribute('hidden', '');
    }
  });

  // 4. Quick Add Patient trigger & form
  dom.btnQuickAddPatient?.addEventListener('click', () => {
    if (!dom.quickPatientModal) return;
    
    dom.suggestionsDropdown?.setAttribute('hidden', '');
    hideAlertEl(dom.quickPatAlert);
    clearQuickPatFieldErrors();
    dom.quickPatientForm?.reset();

    if (dom.quickPatNameInput) {
      dom.quickPatNameInput.value = dom.apptPatientInput.value.trim();
    }
    
    openModalEl(dom.quickPatientModal);
    dom.quickPatCiInput?.focus();
  });

  dom.btnCloseQuickPatModal?.addEventListener('click', closeQuickPatientModal);
  dom.btnCancelQuickPat?.addEventListener('click', closeQuickPatientModal);
  
  dom.quickPatientModal?.addEventListener('click', (e) => {
    if (e.target === dom.quickPatientModal) closeQuickPatientModal();
  });

  dom.quickPatientForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlertEl(dom.quickPatAlert);
    clearQuickPatFieldErrors();

    const name = dom.quickPatNameInput.value.trim();
    const ci = dom.quickPatCiInput.value.trim();
    const phone = dom.quickPatPhoneInput.value.trim();
    const notes = dom.quickPatNotesInput.value.trim();

    let isValid = true;
    if (!name) {
      showQuickPatFieldError('quick-pat-name', 'El nombre completo es obligatorio.');
      isValid = false;
    }
    if (!ci) {
      showQuickPatFieldError('quick-pat-ci', 'La Cédula de Identidad (CI) es obligatoria.');
      isValid = false;
    }
    if (state.isQuickPatCiDuplicated) {
      showQuickPatFieldError('quick-pat-ci', 'La Cédula de Identidad (CI) ya está registrada.');
      isValid = false;
    }
    if (state.isQuickPatPhoneInvalid) {
      showQuickPatFieldError('quick-pat-phone', 'El teléfono ingresado es inválido.');
      isValid = false;
    }

    if (!isValid) return;

    setQuickPatLoading(true);

    try {
      const response = await api.savePatient({
        nombre_completo: name,
        telefono: phone || null,
        ci: ci,
        notas_medicas: notes || null
      });

      const data = await response.json();
      setQuickPatLoading(false);

      if (!response.ok) {
        showQuickPatAlert(data.error || 'Error al registrar el paciente.');
        showToast(data.error || 'Error al registrar el paciente.', 'error');
        return;
      }

      const newPatient = data.patient;
      state.selectedPatientId = newPatient.id;
      
      if (dom.apptPatientInput) dom.apptPatientInput.value = newPatient.nombre_completo;
      if (dom.apptPhoneInput && newPatient.telefono) {
        dom.apptPhoneInput.value = newPatient.telefono;
        const phoneErr = document.getElementById('appt-phone-error');
        if (phoneErr) phoneErr.textContent = '';
        dom.apptPhoneInput.style.borderColor = '';
      }
      
      const patErr = document.getElementById('appt-patient-error');
      if (patErr) patErr.textContent = '';
      dom.apptPatientInput.style.borderColor = '';

      dom.btnQuickAddPatient?.setAttribute('hidden', '');
      closeQuickPatientModal();
      showToast('Paciente registrado con éxito.', 'success');

    } catch (err) {
      console.error(err);
      setQuickPatLoading(false);
      showToast('Error de conexión con el servidor.', 'error');
    }
  });

  // 5. Patient list click delegation for timeline
  dom.patientCardsContainer?.addEventListener('click', async (e) => {
    const btn = e.target.closest('.btn-view-timeline');
    if (!btn) return;
    
    const patientId = btn.dataset.id;
    const name = btn.dataset.name;
    const ci = btn.dataset.ci;
    const notes = btn.dataset.notes;
    
    await openTimelineModal(patientId, name, ci, notes);
  });

  // Timeline modal close triggers
  dom.btnCloseTimelineModal?.addEventListener('click', () => closeModalEl(dom.timelineModal));
  dom.btnCloseTimelineFooter?.addEventListener('click', () => closeModalEl(dom.timelineModal));
  
  dom.timelineModal?.addEventListener('click', (e) => {
    if (e.target === dom.timelineModal) closeModalEl(dom.timelineModal);
  });

  // 6. Realtime search listener for patient list
  dom.searchPatientsInput?.addEventListener('input', (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) {
      renderPatientsList(allPatients);
      return;
    }

    const filtered = allPatients.filter(pat => 
      pat.nombre_completo.toLowerCase().includes(query) || 
      pat.ci.toLowerCase().includes(query)
    );
    renderPatientsList(filtered);
  });

  // Mouse Spotlight Effect en las Tarjetas KPI de Pacientes
  document.querySelectorAll('.pat-kpi-card').forEach(card => {
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);
    });
  });
}
