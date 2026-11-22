// citas.js — Gestión de Citas y Calendario Semanal
import { dom } from './dom.js';
import { state } from './state.js';
import { api } from './api.js';
import { openModalEl, closeModalEl, showToast, showConfirmModal, showAlertEl, hideAlertEl } from './ui.js';
import { escapeHtml, validateBolivianPhone } from './utils.js';
import { openClinicalModal } from './ficha.js';
import { initTreatmentAutocomplete, getActiveTreatments } from './tratamientos.js?v=7';

export function initAgendaDate() {
  const localDate = new Date();
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  state.currentAgendaDate = `${yyyy}-${mm}-${dd}`;
  
  if (dom.agendaDatePicker) {
    dom.agendaDatePicker.value = state.currentAgendaDate;
  }
  updateDateBadge();
}

export function updateDateBadge() {
  if (!dom.currentDateEl) return;
  
  if (state.currentView === 'day') {
    const dateObj = new Date(`${state.currentAgendaDate}T00:00:00`);
    const opts = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    let str = dateObj.toLocaleDateString('es-ES', opts);
    dom.currentDateEl.textContent = str.charAt(0).toUpperCase() + str.slice(1);
  } else {
    calculateWeekDays();
    const monDate = new Date(`${state.weekDaysDates[0]}T00:00:00`);
    const lastDate = new Date(`${state.weekDaysDates[state.weekDaysDates.length - 1]}T00:00:00`);
    
    const monStr = monDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    const lastStr = lastDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    
    dom.currentDateEl.textContent = `Semana del ${monStr} al ${lastStr}`;
  }
}

export function calculateWeekDays() {
  const pivot = new Date(`${state.currentAgendaDate}T00:00:00`);
  const dayIndex = pivot.getDay();
  const monDiff = dayIndex === 0 ? -6 : 1 - dayIndex;
  
  const mon = new Date(pivot);
  mon.setDate(pivot.getDate() + monDiff);
  
  state.weekDaysDates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    state.weekDaysDates.push(`${yyyy}-${mm}-${dd}`);
  }
}

function showAgendaSkeletons() {
  if (state.currentView !== 'day' || !dom.appointmentList) return;
  dom.appointmentList.innerHTML = `
    <div class="appointment-card skeleton-shimmer" style="height: 90px; pointer-events: none; opacity: 0.85; margin-bottom: 12px; border-radius: 12px;"></div>
    <div class="appointment-card skeleton-shimmer" style="height: 90px; pointer-events: none; opacity: 0.7; margin-bottom: 12px; border-radius: 12px;"></div>
    <div class="appointment-card skeleton-shimmer" style="height: 90px; pointer-events: none; opacity: 0.55; margin-bottom: 12px; border-radius: 12px;"></div>
  `;
}

export async function loadAppointments() {
  hideAgendaAlert();
  showAgendaSkeletons();
  try {
    // Cargar excepciones/feriados
    try {
      const excRes = await fetch('/api/configuracion/exceptions');
      if (excRes.ok) {
        const excData = await excRes.json();
        state.exceptions = excData.exceptions || [];
      } else {
        state.exceptions = [];
      }
    } catch (excErr) {
      console.error('Error al cargar excepciones de feriados:', excErr);
      state.exceptions = [];
    }

    updateDateBadge();

    if (state.currentView === 'day') {
      const data = await api.getAppointments(state.currentAgendaDate);
      renderAppointments(data.appointments);
    } else {
      calculateWeekDays();
      const startDay = state.weekDaysDates[0];
      const endDay = state.weekDaysDates[state.weekDaysDates.length - 1];
      const data = await api.getAppointmentsRange(startDay, endDay);
      await renderWeeklyCalendar(data.appointments);
    }
  } catch (err) {
    console.error(err.message);
  }
}

export function renderAppointments(appointments) {
  if (!dom.appointmentList) return;
  dom.appointmentList.innerHTML = '';

  const isHoliday = (state.exceptions || []).find(ex => {
    if (ex.is_recurring === 1) {
      return ex.exception_date.substring(5) === state.currentAgendaDate.substring(5);
    }
    return ex.exception_date === state.currentAgendaDate;
  });
  if (isHoliday) {
    dom.appointmentList.innerHTML = `
      <div class="empty-state" style="border: 1px dashed rgba(239, 68, 68, 0.25); background: rgba(239, 68, 68, 0.03); padding: 40px 24px; border-radius: 12px; margin-top: 16px; text-align: center;">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="1.5" style="width: 48px; height: 48px; margin: 0 auto 16px auto; color: var(--danger); display: block;">
          <circle cx="12" cy="12" r="10" />
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
        <h4 style="color: var(--danger); font-size: 16px; font-weight: 700; margin-bottom: 8px;">Consultorio Cerrado</h4>
        <p style="color: var(--text-muted); font-size: 13.5px; line-height: 1.5; margin: 0;">Este día está registrado como feriado o no laborable:<br><strong style="color: var(--text-primary); font-weight: 600;">${escapeHtml(isHoliday.description)}</strong></p>
      </div>
    `;
    updateStats(0, 0, 0);
    return;
  }

  if (!appointments || appointments.length === 0) {
    dom.appointmentList.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
          <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <p>No hay citas programadas para este día.<br>Usa el botón "Agendar Cita" para comenzar.</p>
      </div>
    `;
    updateStats(0, 0, 0);
    return;
  }

  appointments.forEach(appt => {
    const status = appt.status || 'Programada';
    let statusClass = 'programada';
    if (status === 'En Espera') statusClass = 'en-espera';
    else if (status === 'Atendida') statusClass = 'atendida';
    else if (status === 'Ausente') statusClass = 'ausente';

    const card = document.createElement('div');
    card.className = `appointment-card dynamic ${statusClass}`;
    
    if (state.recentlyMovedApptId && String(appt.id) === String(state.recentlyMovedApptId)) {
      card.classList.add('recently-moved');
      card.addEventListener('animationend', () => {
        card.classList.remove('recently-moved');
      }, { once: true });
    }
    
    const [h, m] = appt.appointment_time.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;
    const timeLabel = `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;

    card.dataset.id = appt.id;
    card.dataset.patient = appt.patient_name;
    card.dataset.phone = appt.patient_phone || '';
    card.dataset.treatment = appt.treatment;
    card.dataset.date = appt.appointment_date;
    card.dataset.rawTime = appt.appointment_time;
    card.dataset.time = timeLabel;
    card.dataset.patientId = appt.patient_id || '';

    const waUrl = appt.patient_phone ? `https://wa.me/${appt.patient_phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola ${appt.patient_name}, le recordamos su cita para el tratamiento de ${appt.treatment} el día ${appt.appointment_date} a las ${timeLabel} en el Consultorio Odontológico "Cristo Rey".`)}` : '#';

    // Buscar color de categoría del tratamiento en el caché
    const matchedT = (state.treatments || []).find(t => t.nombre && appt.treatment && t.nombre.toLowerCase() === appt.treatment.toLowerCase());
    const treatColor = matchedT?.color || null;
    const treatCategoria = matchedT?.categoria || null;
    const treatBadge = (treatColor && treatCategoria)
      ? `<span style="display:inline-block;font-size:10px;font-weight:700;padding:2px 7px;border-radius:20px;
          background:${hexToRgba(treatColor, 0.13)};color:${treatColor};
          border:1px solid ${hexToRgba(treatColor, 0.3)};letter-spacing:0.2px;
          text-transform:uppercase;margin-left:6px;vertical-align:middle;">${escapeHtml(treatCategoria)}</span>`
      : '';

    card.innerHTML = `
      <span class="app-time">${timeLabel}</span>
      <span class="app-patient">
        ${escapeHtml(appt.patient_name)}
        ${appt.patient_phone ? `
          <small style="color: var(--text-muted); font-size: 12px; font-weight: normal; margin-left: 6px;">(${escapeHtml(appt.patient_phone)})</small>
        ` : ''}
      </span>
      <span class="app-treatment">${escapeHtml(appt.treatment)}${treatBadge}</span>
      <button class="clinical-btn" data-id="${appt.id}" title="Registrar tratamientos en Módulo Clínico">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
        Abrir Ficha
      </button>
      <select class="status-select ${statusClass}" data-id="${appt.id}" title="Cambio rápido de estado">
        <option value="Programada" ${status === 'Programada' ? 'selected' : ''}>Programada</option>
        <option value="En Espera" ${status === 'En Espera' ? 'selected' : ''}>En Espera</option>
        <option value="Atendida" ${status === 'Atendida' ? 'selected' : ''}>Atendida</option>
        <option value="Ausente" ${status === 'Ausente' ? 'selected' : ''}>Ausente</option>
      </select>
    `;
    dom.appointmentList.appendChild(card);
  });

  const total = appointments.length;
  const confirmedCount = appointments.filter(appt => appt.status === 'Atendida').length;
  const pendingCount = appointments.filter(appt => appt.status === 'Programada' || appt.status === 'En Espera' || !appt.status).length;
  updateStats(total, confirmedCount, pendingCount);
}

function hexToRgba(hex, alpha) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!r) return `rgba(59,130,246,${alpha})`;
  return `rgba(${parseInt(r[1],16)},${parseInt(r[2],16)},${parseInt(r[3],16)},${alpha})`;
}

export function updateStats(total, confirmed, pending) {
  if (dom.statTotal)     dom.statTotal.textContent     = total;
  if (dom.statConfirmed) dom.statConfirmed.textContent = confirmed;
  if (dom.statPending)   dom.statPending.textContent   = pending;
}

export function openModal() {
  openModalEl(dom.modal);
  const localDate = new Date();
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  const todayStr = `${yyyy}-${mm}-${dd}`;
  
  const dateInput = document.getElementById('appt-date');
  if (dateInput) {
    dateInput.min = todayStr;
    dateInput.value = todayStr;
  }
  
  dom.apptPatientInput.focus();
}

export function closeModal() {
  closeModalEl(dom.modal, () => {
    dom.appointmentForm.reset();
    hideModalAlert();
    clearAllFieldErrors();
    setModalLoading(false);

    state.selectedPatientId = null;
    dom.btnQuickAddPatient?.setAttribute('hidden', '');
    dom.suggestionsDropdown?.setAttribute('hidden', '');
    if (dom.suggestionsDropdown) dom.suggestionsDropdown.innerHTML = '';

    state.editingApptId = null;
    state.isApptPhoneInvalid = false;
    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = 'Nueva Cita';
    const btnSaveText = dom.btnSaveAppt?.querySelector('.btn-text');
    if (btnSaveText) btnSaveText.textContent = 'Guardar Cita';
  });
}

export function showModalAlert(msg, type = 'error') {
  dom.modalAlertText.textContent = msg;
  showAlertEl(dom.modalAlert);
  if (type === 'warning') {
    dom.modalAlert.classList.add('warning');
  } else {
    dom.modalAlert.classList.remove('warning');
  }
}

export function hideModalAlert() {
  hideAlertEl(dom.modalAlert);
}

export function showFieldError(id, msg) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = msg;
  if (input) input.style.borderColor = 'var(--danger)';
}

export function clearFieldError(id) {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id);
  if (el) el.textContent = '';
  if (input) input.style.borderColor = '';
}

export function clearAllFieldErrors() {
  ['appt-patient', 'appt-phone', 'appt-treatment', 'appt-date', 'appt-time'].forEach(clearFieldError);
}

export function setModalLoading(isLoading) {
  const btnText = dom.btnSaveAppt?.querySelector('.btn-text');
  const spinner = dom.btnSaveAppt?.querySelector('.spinner');
  if (!dom.btnSaveAppt) return;
  dom.btnSaveAppt.disabled = isLoading;
  if (btnText) btnText.style.opacity = isLoading ? '0' : '1';
  if (spinner) isLoading ? spinner.removeAttribute('hidden') : spinner.setAttribute('hidden', '');
}

// ────────────────────────────────────────────────────────────
// Calendario Semanal Drag-and-Drop
// ────────────────────────────────────────────────────────────

function toMinutes(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

function getSlots() {
  let minMinutes = 8 * 60;
  let maxMinutes = 18 * 60;
  
  if (state.clinicHours && state.clinicHours.timeWindows && state.clinicHours.timeWindows.length > 0) {
    const starts = state.clinicHours.timeWindows.map(w => toMinutes(w.start));
    const ends = state.clinicHours.timeWindows.map(w => toMinutes(w.end));
    minMinutes = Math.min(...starts);
    maxMinutes = Math.max(...ends);
  }
  
  const slots = [];
  for (let m = minMinutes; m < maxMinutes; m += 30) {
    const hh = String(Math.floor(m / 60)).padStart(2, '0');
    const mm = String(m % 60).padStart(2, '0');
    slots.push(`${hh}:${mm}`);
  }
  return slots;
}

function findClosestSlot(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m;
  const slots = getSlots();
  if (slots.length === 0) return '08:00';
  
  let bestSlot = slots[0];
  let minDiff = Infinity;
  
  slots.forEach(slot => {
    const slotMin = toMinutes(slot);
    const diff = Math.abs(totalMin - slotMin);
    if (diff < minDiff) {
      minDiff = diff;
      bestSlot = slot;
    }
  });
  return bestSlot;
}

export function showAgendaAlert(msg) {
  if (dom.agendaAlertText) dom.agendaAlertText.textContent = msg;
  showAlertEl(dom.agendaAlert);
  dom.agendaAlert?.classList.add('shake-animation');
  setTimeout(() => {
    dom.agendaAlert?.classList.remove('shake-animation');
  }, 400);
}

export function hideAgendaAlert() {
  hideAlertEl(dom.agendaAlert);
}

async function getClinicHours() {
  if (state.clinicHours) return state.clinicHours;
  try {
    const res = await api.getClinicHours();
    if (res.ok) {
      state.clinicHours = await res.json();
    }
  } catch (err) {
    console.error('Error al obtener clinic_hours:', err);
  }
  if (!state.clinicHours) {
    state.clinicHours = {
      workDays: [1, 2, 3, 4, 5],
      timeWindows: [
        { start: "08:00", end: "12:00" },
        { start: "14:00", end: "18:00" }
      ]
    };
  }
  return state.clinicHours;
}

export async function renderWeeklyCalendar(appointments) {
  if (!dom.calendarGrid) return;
  dom.calendarGrid.innerHTML = '';
  
  const hoursConfig = await getClinicHours();
  calculateWeekDays();
  
  dom.calendarGrid.style.gridTemplateColumns = `70px repeat(${state.weekDaysDates.length}, minmax(110px, 1fr))`;
  
  const timeHeader = document.createElement('div');
  timeHeader.className = 'calendar-header-cell time-col-header';
  timeHeader.textContent = 'Hora';
  dom.calendarGrid.appendChild(timeHeader);
  
  const dayNames = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  
  state.weekDaysDates.forEach((dateStr, index) => {
    const header = document.createElement('div');
    header.className = 'calendar-header-cell';
    if (dateStr === todayStr) {
      header.classList.add('today-header');
    }
    
    const dayNum = dateStr.split('-')[2];
    header.innerHTML = `${dayNames[index]} <span class="day-num">${dayNum}</span>`;
    dom.calendarGrid.appendChild(header);
  });
  
  const slots = getSlots();
  
  slots.forEach(slot => {
    const timeCell = document.createElement('div');
    timeCell.className = 'calendar-time-label-cell';
    
    const [h, m] = slot.split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'pm' : 'am';
    const hour12 = hour % 12 || 12;
    timeCell.textContent = `${hour12}:${m} ${ampm}`;
    dom.calendarGrid.appendChild(timeCell);
    
    state.weekDaysDates.forEach(day => {
      const cell = document.createElement('div');
      cell.className = 'calendar-cell';
      cell.dataset.date = day;
      cell.dataset.time = slot;
      
      const dateObj = new Date(`${day}T00:00:00`);
      const dayOfWeek = dateObj.getDay();
      const slotMinutes = toMinutes(slot);
      
      const isWorkDay = hoursConfig.workDays.includes(dayOfWeek);
      const isWithinWindow = hoursConfig.timeWindows.some(w => {
        const startMin = toMinutes(w.start);
        const endMin = toMinutes(w.end);
        return slotMinutes >= startMin && slotMinutes < endMin;
      });
      
      const holidayObj = (state.exceptions || []).find(ex => {
        if (ex.is_recurring === 1) {
          return ex.exception_date.substring(5) === day.substring(5);
        }
        return ex.exception_date === day;
      });
      const isHoliday = !!holidayObj;
      
      if (!isWorkDay || !isWithinWindow || isHoliday) {
        cell.classList.add('non-working-slot');
        if (isHoliday) {
          cell.classList.add('holiday-slot');
          cell.title = `Cerrado por feriado: ${holidayObj.description}`;
        }
      }
      
      dom.calendarGrid.appendChild(cell);
    });
  });
  
  appointments.forEach(appt => {
    const closestTime = findClosestSlot(appt.appointment_time);
    const cell = dom.calendarGrid.querySelector(`.calendar-cell[data-date="${appt.appointment_date}"][data-time="${closestTime}"]`);
    if (cell) {
      const status = appt.status || 'Programada';
      let statusClass = 'programada';
      if (status === 'En Espera') statusClass = 'en-espera';
      else if (status === 'Atendida') statusClass = 'atendida';
      else if (status === 'Ausente') statusClass = 'ausente';
      
      const card = document.createElement('div');
      card.className = `appointment-card ${statusClass}`;
      
      if (state.recentlyMovedApptId && String(appt.id) === String(state.recentlyMovedApptId)) {
        card.classList.add('recently-moved');
        card.addEventListener('animationend', () => {
          card.classList.remove('recently-moved');
        }, { once: true });
      }
      
      card.draggable = true;
      card.dataset.id = appt.id;
      card.dataset.patient = appt.patient_name;
      card.dataset.phone = appt.patient_phone || '';
      card.dataset.treatment = appt.treatment;
      card.dataset.date = appt.appointment_date;
      card.dataset.rawTime = appt.appointment_time;
      card.dataset.patientId = appt.patient_id || '';
      
      const [h, m] = appt.appointment_time.split(':');
      const hour = parseInt(h);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const hour12 = hour % 12 || 12;
      const timeLabel = `${String(hour12).padStart(2, '0')}:${m} ${ampm}`;
      card.dataset.time = timeLabel;
      
      card.innerHTML = `
        <span class="app-time">${timeLabel}</span>
        <span class="app-patient">${escapeHtml(appt.patient_name)}</span>
        <span class="app-treatment">${escapeHtml(appt.treatment)}</span>
      `;
      
      card.addEventListener('click', (e) => {
        e.stopPropagation();
        openStatusModal(card);
      });
      
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', appt.id);
        card.classList.add('dragging');
        card.dataset.originDate = card.parentNode.dataset.date;
        card.dataset.originTime = card.parentNode.dataset.time;
        dom.calendarGrid?.classList.add('drag-active-grid');
      });
      
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        dom.calendarGrid?.classList.remove('drag-active-grid');
      });
      
      cell.appendChild(card);
    }
  });
  
  const cells = dom.calendarGrid.querySelectorAll('.calendar-cell');
  cells.forEach(cell => {
    cell.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (!cell.classList.contains('non-working-slot')) {
        cell.classList.add('drag-over');
      }
    });
    
    cell.addEventListener('dragleave', () => {
      cell.classList.remove('drag-over');
    });
    
    cell.addEventListener('drop', async (e) => {
      e.preventDefault();
      cell.classList.remove('drag-over');
      
      const apptId = e.dataTransfer.getData('text/plain');
      const dragCard = document.querySelector(`.appointment-card[data-id="${apptId}"]`);
      if (!dragCard) return;
      
      const newDate = cell.dataset.date;
      const newTime = cell.dataset.time;
      const oldDate = dragCard.dataset.originDate;
      const oldTime = dragCard.dataset.originTime;
      
      if (newDate === oldDate && newTime === oldTime) {
        return;
      }
      
      cell.appendChild(dragCard);
      
      try {
        const response = await api.patchAppointment(apptId, {
          appointment_date: newDate,
          appointment_time: newTime
        });
        
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Error de validación al reprogramar.');
        }
        
        dragCard.dataset.originDate = newDate;
        dragCard.dataset.originTime = newTime;
        state.recentlyMovedApptId = apptId;
        await loadAppointments();
        showToast('Cita reprogramada con éxito.', 'success');
        
      } catch (err) {
        const originalCell = dom.calendarGrid.querySelector(`.calendar-cell[data-date="${oldDate}"][data-time="${oldTime}"]`);
        if (originalCell) {
          originalCell.appendChild(dragCard);
          dragCard.classList.add('snap-back');
          dragCard.addEventListener('animationend', () => {
            dragCard.classList.remove('snap-back');
          }, { once: true });
        }
        showToast(err.message || 'No se pudo reprogramar la cita.', 'error');
        await loadAppointments();
      }
    });
  });
}

// ────────────────────────────────────────────────────────────
// Lógica de Gestión de Estado de Cita (Status Modal)
// ────────────────────────────────────────────────────────────

let selectedApptId = null;
let selectedApptData = null;

export function openStatusModal(card) {
  const id = card.dataset.id;
  const patient = card.dataset.patient;
  const phone = card.dataset.phone;
  const treatment = card.dataset.treatment;
  const date = card.dataset.date;
  const rawTime = card.dataset.rawTime;
  const timeLabel = card.dataset.time;
  const patientId = card.dataset.patientId || '';

  selectedApptId = id;
  selectedApptData = { id, patient, phone, treatment, date, rawTime, timeLabel, patientId };

  if (dom.statusPatientName) dom.statusPatientName.textContent = patient;
  if (dom.statusTreatmentName) dom.statusTreatmentName.textContent = treatment;
  if (dom.statusTimeValue) dom.statusTimeValue.textContent = `${date} (${timeLabel})`;

  if (phone) {
    if (dom.statusPhoneValue) dom.statusPhoneValue.textContent = phone;
    dom.statusPhoneRow?.removeAttribute('hidden');
  } else {
    dom.statusPhoneRow?.setAttribute('hidden', '');
  }

  hideStatusModalAlert();

  const apptDate = new Date(`${date}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const isPast = apptDate < today;

  if (isPast) {
    showAlertEl(dom.statusModalPastNotice);
    if (dom.btnCancelAppointment) dom.btnCancelAppointment.disabled = true;
    if (dom.btnEditAppointment) dom.btnEditAppointment.disabled = true;
    dom.statusActionBtns.forEach(btn => btn.disabled = false);
  } else {
    hideAlertEl(dom.statusModalPastNotice);
    if (dom.btnCancelAppointment) dom.btnCancelAppointment.disabled = false;
    if (dom.btnEditAppointment) dom.btnEditAppointment.disabled = false;
    dom.statusActionBtns.forEach(btn => btn.disabled = false);
  }

  openModalEl(dom.statusModal);
}

export function closeStatusModal() {
  closeModalEl(dom.statusModal, () => {
    selectedApptId = null;
    selectedApptData = null;
    hideStatusModalAlert();
  });
}

export function hideStatusModalAlert() {
  hideAlertEl(dom.statusModalAlert);
}

export function showStatusModalAlert(msg) {
  if (dom.statusModalAlertText) dom.statusModalAlertText.textContent = msg;
  showAlertEl(dom.statusModalAlert);
}

export function setupStatusModalHandlers() {
  dom.btnCloseStatusModal?.addEventListener('click', closeStatusModal);
  dom.btnCloseStatusModalFooter?.addEventListener('click', closeStatusModal);
  dom.statusModal?.addEventListener('click', (e) => {
    if (e.target === dom.statusModal) closeStatusModal();
  });

  dom.statusActionBtns.forEach(btn => {
    btn.addEventListener('click', async () => {
      const status = btn.dataset.status;
      if (!selectedApptId || !status) return;
      hideStatusModalAlert();

      try {
        const res = await api.updateAppointmentStatus(selectedApptId, status);
        if (!res.ok) {
          const data = await res.json();
          showStatusModalAlert(data.error || 'Error al actualizar el estado de la cita.');
          return;
        }

        closeStatusModal();
        state.recentlyMovedApptId = selectedApptId;
        await loadAppointments();
        showToast('Estado de la cita actualizado con éxito.', 'success');
      } catch (err) {
        console.error('Error al actualizar el estado:', err);
        showToast('Error de conexión con el servidor.', 'error');
      }
    });
  });

  dom.btnCancelAppointment?.addEventListener('click', () => {
    if (!selectedApptId) return;
    showConfirmModal(
      'Cancelar Cita',
      '¿Está seguro de que desea cancelar esta cita? La cita se guardará históricamente pero se liberará del itinerario.',
      true,
      async () => {
        closeStatusModal();
        try {
          const res = await api.cancelAppointment(selectedApptId);
          if (!res.ok) {
            const data = await res.json();
            showToast(data.error || 'Error al cancelar la cita.', 'error');
            return;
          }
          await loadAppointments();
          showToast('Cita cancelada con éxito.', 'success');
        } catch (err) {
          console.error(err);
          showToast('Error de conexión con el servidor.', 'error');
        }
      }
    );
  });

  dom.btnEditAppointment?.addEventListener('click', () => {
    if (!selectedApptId || !selectedApptData) return;

    closeStatusModal();

    document.getElementById('appt-patient').value = selectedApptData.patient;
    document.getElementById('appt-phone').value = selectedApptData.phone;
    document.getElementById('appt-treatment').value = selectedApptData.treatment;
    document.getElementById('appt-date').value = selectedApptData.date;
    document.getElementById('appt-time').value = selectedApptData.rawTime;

    const modalTitle = document.getElementById('modal-title');
    if (modalTitle) modalTitle.textContent = 'Editar Cita';
    const btnSaveText = dom.btnSaveAppt?.querySelector('.btn-text');
    if (btnSaveText) btnSaveText.textContent = 'Guardar Cambios';

    state.editingApptId = selectedApptId;
    state.selectedPatientId = selectedApptData.patientId ? parseInt(selectedApptData.patientId) : null;

    dom.modal.removeAttribute('hidden');
    document.getElementById('appt-patient').focus();
  });

  // Inicializar autocompletado de tratamientos una sola vez al inicio
  initTreatmentAutocomplete('appt-treatment', 'appt-treatment-suggestions', (treatment) => {
    // Rellena automáticamente el nombre (manejado por el motor de autocompletado)
  });
}
