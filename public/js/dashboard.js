// dashboard.js — Coordinador y Punto de Entrada Principal (ES Modules)
import { dom } from './modules/dom.js';
import { state } from './modules/state.js';
import { api } from './modules/api.js';
import { verifySession, setupProfileHandlers } from './modules/session.js';
import { showToast, showConfirmModal } from './modules/ui.js';
import {
  initAgendaDate,
  updateDateBadge,
  loadAppointments,
  openModal,
  closeModal,
  hideModalAlert,
  showFieldError,
  clearFieldError,
  setModalLoading,
  setupStatusModalHandlers,
  updateStats
} from './modules/citas.js';
import { loadPatients, setupPatientHandlers } from './modules/pacientes.js?v=27.2.1';
import { loadAndRenderTreatments, setupTreatmentsHandlers } from './modules/tratamientos.js?v=27.2.1';
import { initOdontogramaUI, openClinicalModal, setupFichaHandlers } from './modules/ficha.js?v=27.2.1';
import { setupSettingsHandlers, loadSettings } from './modules/settings.js?v=27.2.1';
import { loadFinancialReports, setupReportsHandlers } from './modules/reportes.js?v=27.2.1';
import { loadTreatments } from './modules/tratamientos.js?v=27.2.1';
import { loadInventario, initInventarioHandlers } from './modules/inventario.js?v=27.2.1';
import { setupPredictionHandlers } from './modules/prediction.js?v=27.2.3';


// Exponer loadAppointments en window para que ficha.js pueda refrescar la agenda tras guardar historial
window.loadAppointments = loadAppointments;

document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 1. Verificación de Sesión e Inicialización
  // ============================================================
  verifySession(async () => {
    initAgendaDate();
    initOdontogramaUI();
    setupProfileHandlers();
    initInventarioHandlers();
    setupTreatmentsHandlers();
    setupPatientHandlers();
    setupFichaHandlers();
    setupSettingsHandlers();
    setupReportsHandlers();
    await setupPredictionHandlers();
    setupStatusModalHandlers();
    
    // Precargar catálogo de tratamientos en caché para autocompletados
    await loadTreatments();
    
    // Cargar citas iniciales
    await loadAppointments();
  });

  // Helper para activar pestaña
  function activateTab(targetTab) {
    const tabs = [
      dom.tabAgendaContent,
      dom.tabPatientsContent,
      dom.tabSettingsContent,
      dom.tabReportsContent,
      dom.tabInventarioContent,
      dom.tabTratamientosContent
    ];
    tabs.forEach(t => {
      if (t) {
        t.hidden = true;
        t.setAttribute('hidden', '');
      }
    });
    if (targetTab) {
      targetTab.hidden = false;
      targetTab.removeAttribute('hidden');
    }
    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.scrollTop = 0;
    }
  }

  // ============================================================
  // 2. Controladores de Pestañas (Tabs)
  // ============================================================
  dom.navLinkAgenda?.addEventListener('click', (e) => {
    e.preventDefault();
    dom.navLinkPatients?.classList.remove('active');
    dom.navLinkSettings?.classList.remove('active');
    dom.navLinkReports?.classList.remove('active');
    dom.navLinkInventario?.classList.remove('active');
    dom.navLinkTratamientos?.classList.remove('active');
    dom.navLinkAgenda.classList.add('active');
    activateTab(dom.tabAgendaContent);
  });

  dom.navLinkPatients?.addEventListener('click', async (e) => {
    e.preventDefault();
    dom.navLinkAgenda?.classList.remove('active');
    dom.navLinkSettings?.classList.remove('active');
    dom.navLinkReports?.classList.remove('active');
    dom.navLinkInventario?.classList.remove('active');
    dom.navLinkTratamientos?.classList.remove('active');
    dom.navLinkPatients.classList.add('active');
    activateTab(dom.tabPatientsContent);
    await loadPatients();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  dom.navLinkSettings?.addEventListener('click', async (e) => {
    e.preventDefault();
    dom.navLinkAgenda?.classList.remove('active');
    dom.navLinkPatients?.classList.remove('active');
    dom.navLinkReports?.classList.remove('active');
    dom.navLinkInventario?.classList.remove('active');
    dom.navLinkTratamientos?.classList.remove('active');
    dom.navLinkSettings.classList.add('active');
    activateTab(dom.tabSettingsContent);
    await loadSettings();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  dom.navLinkReports?.addEventListener('click', async (e) => {
    e.preventDefault();
    dom.navLinkAgenda?.classList.remove('active');
    dom.navLinkPatients?.classList.remove('active');
    dom.navLinkSettings?.classList.remove('active');
    dom.navLinkInventario?.classList.remove('active');
    dom.navLinkTratamientos?.classList.remove('active');
    dom.navLinkReports.classList.add('active');
    activateTab(dom.tabReportsContent);
    await loadFinancialReports();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  dom.navLinkTratamientos?.addEventListener('click', async (e) => {
    e.preventDefault();
    dom.navLinkAgenda?.classList.remove('active');
    dom.navLinkPatients?.classList.remove('active');
    dom.navLinkSettings?.classList.remove('active');
    dom.navLinkReports?.classList.remove('active');
    dom.navLinkInventario?.classList.remove('active');
    dom.navLinkTratamientos.classList.add('active');
    activateTab(dom.tabTratamientosContent);
    setupTreatmentsHandlers();
    await loadAndRenderTreatments();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  dom.navLinkInventario?.addEventListener('click', async (e) => {
    e.preventDefault();
    dom.navLinkAgenda?.classList.remove('active');
    dom.navLinkPatients?.classList.remove('active');
    dom.navLinkSettings?.classList.remove('active');
    dom.navLinkReports?.classList.remove('active');
    dom.navLinkTratamientos?.classList.remove('active');
    dom.navLinkInventario.classList.add('active');
    activateTab(dom.tabInventarioContent);
    initInventarioHandlers();
    await loadInventario();
    document.querySelector('.main-content')?.scrollTo({ top: 0, behavior: 'instant' });
  });

  // ============================================================
  // 3. Cierre de Sesión
  // ============================================================
  dom.btnLogout?.addEventListener('click', () => {
    showConfirmModal(
      'Cerrar Sesión',
      '¿Está seguro de que desea cerrar la sesión actual en el Consultorio Odontológico "Cristo Rey"?',
      false,
      async () => {
        try {
          const res = await api.logout();
          if (res.ok) {
            sessionStorage.clear();
            window.location.href = 'index.html';
          } else {
            showToast('Error al cerrar la sesión en el servidor.', 'error');
          }
        } catch (err) {
          showToast('Error de conexión al cerrar sesión.', 'error');
        }
      }
    );
  });

  // ============================================================
  // Selector de Tema Visual (Claro / Oscuro)
  // ============================================================
  const initThemeIcons = () => {
    const isLight = document.body.classList.contains('light-theme');
    if (isLight) {
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'block';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'none';
    } else {
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'none';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'block';
    }
  };
  initThemeIcons();

  dom.btnThemeToggle?.addEventListener('click', () => {
    const isCurrentlyLight = document.body.classList.contains('light-theme');
    if (isCurrentlyLight) {
      document.body.classList.remove('light-theme');
      localStorage.setItem('theme', 'dark');
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'none';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'block';
    } else {
      document.body.classList.add('light-theme');
      localStorage.setItem('theme', 'light');
      if (dom.themeIconSun) dom.themeIconSun.style.display = 'block';
      if (dom.themeIconMoon) dom.themeIconMoon.style.display = 'none';
    }
  });

  // ============================================================
  // 4. Efectos visuales de tarjetas (Puro CSS hover glow)
  // ============================================================

  // ============================================================
  // 5. Navegación de Fecha de Agenda y Vistas (Día / Semana)
  // ============================================================
  dom.agendaDatePicker?.addEventListener('change', async (e) => {
    state.currentAgendaDate = e.target.value;
    updateDateBadge();
    await loadAppointments();
  });

  dom.btnPrevDay?.addEventListener('click', async () => {
    const dateObj = new Date(`${state.currentAgendaDate}T00:00:00`);
    const diff = state.currentView === 'week' ? 7 : 1;
    dateObj.setDate(dateObj.getDate() - diff);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    state.currentAgendaDate = `${yyyy}-${mm}-${dd}`;
    if (dom.agendaDatePicker) dom.agendaDatePicker.value = state.currentAgendaDate;
    updateDateBadge();
    await loadAppointments();
  });

  dom.btnNextDay?.addEventListener('click', async () => {
    const dateObj = new Date(`${state.currentAgendaDate}T00:00:00`);
    const diff = state.currentView === 'week' ? 7 : 1;
    dateObj.setDate(dateObj.getDate() + diff);
    const yyyy = dateObj.getFullYear();
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const dd = String(dateObj.getDate()).padStart(2, '0');
    state.currentAgendaDate = `${yyyy}-${mm}-${dd}`;
    if (dom.agendaDatePicker) dom.agendaDatePicker.value = state.currentAgendaDate;
    updateDateBadge();
    await loadAppointments();
  });

  dom.btnViewDay?.addEventListener('click', async () => {
    if (state.currentView === 'day') return;
    state.currentView = 'day';
    dom.btnViewWeek.classList.remove('active');
    dom.btnViewDay.classList.add('active');
    
    dom.calendarView.setAttribute('hidden', '');
    dom.statsGrid.removeAttribute('hidden');
    dom.agendaSection.removeAttribute('hidden');
    
    if (dom.agendaSectionTitle) dom.agendaSectionTitle.textContent = 'Citas de Hoy';
    
    updateDateBadge();
    await loadAppointments();
  });

  dom.btnViewWeek?.addEventListener('click', async () => {
    if (state.currentView === 'week') return;
    state.currentView = 'week';
    dom.btnViewDay.classList.remove('active');
    dom.btnViewWeek.classList.add('active');
    
    dom.statsGrid.setAttribute('hidden', '');
    dom.agendaSection.setAttribute('hidden', '');
    dom.calendarView.removeAttribute('hidden');
    
    if (dom.agendaSectionTitle) dom.agendaSectionTitle.textContent = 'Cuadrícula Semanal';
    
    updateDateBadge();
    await loadAppointments();
  });

  // ============================================================
  // 6. Formulario de Cita: Apertura y Envío
  // ============================================================
  dom.btnOpenModal?.addEventListener('click', openModal);
  dom.btnCloseModal?.addEventListener('click', closeModal);
  dom.btnCancelModal?.addEventListener('click', closeModal);

  dom.modal?.addEventListener('click', (e) => {
    if (e.target === dom.modal) closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && dom.modal && !dom.modal.hasAttribute('hidden')) {
      closeModal();
    }
  });

  dom.appointmentForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideModalAlert();

    const patient = document.getElementById('appt-patient').value.trim();
    const phone = document.getElementById('appt-phone').value.trim();
    const treatment = document.getElementById('appt-treatment').value.trim();
    const date = document.getElementById('appt-date').value;
    const time = document.getElementById('appt-time').value;

    let isValid = true;
    if (!patient)   { showFieldError('appt-patient',   'El nombre del paciente es obligatorio.'); isValid = false; }
    if (!treatment) { showFieldError('appt-treatment', 'El tratamiento es obligatorio.'); isValid = false; }
    if (!date)      { showFieldError('appt-date',      'La fecha es obligatoria.'); isValid = false; }
    
    const localDate = new Date();
    localDate.setHours(0, 0, 0, 0);
    const selectedDate = new Date(`${date}T00:00:00`);
    if (date && selectedDate < localDate) {
      showFieldError('appt-date', 'La fecha de la cita no puede ser anterior al día de hoy.');
      isValid = false;
    }

    if (!time)      { showFieldError('appt-time',      'La hora es obligatoria.'); isValid = false; }
    if (state.isApptPhoneInvalid) {
      showFieldError('appt-phone', 'El teléfono ingresado es inválido.');
      isValid = false;
    }
    if (!isValid) return;

    setModalLoading(true);

    try {
      const res = await api.saveAppointment(state.editingApptId, {
        patient_name:     patient,
        patient_phone:    phone || null,
        treatment:        treatment,
        appointment_date: date,
        appointment_time: time,
        patient_id:       state.selectedPatientId || null
      });

      const data = await res.json();

      if (!res.ok) {
        const alertType = res.status === 409 ? 'warning' : 'error';
        showToast(data.error || 'Error al guardar la cita. Intente de nuevo.', alertType);
        setModalLoading(false);
        return;
      }

      state.recentlyMovedApptId = data.appointment?.id || state.editingApptId;
      closeModal();
      await loadAppointments();
      showToast(state.editingApptId ? 'Cita modificada con éxito.' : 'Cita agendada con éxito.', 'success');

    } catch (err) {
      showToast('Error de conexión con el servidor.', 'error');
      setModalLoading(false);
    }
  });

  // Limpiar error al escribir
  ['appt-patient', 'appt-treatment', 'appt-date', 'appt-time'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => clearFieldError(id));
  });

  // ============================================================
  // 7. Clics en la Agenda (Selectores Rápidos y Modal Clínico)
  // ============================================================
  dom.appointmentList?.addEventListener('click', (e) => {
    const btn = e.target.closest('.clinical-btn');
    if (!btn) return;
    e.stopPropagation();

    const card = btn.closest('.appointment-card.dynamic');
    if (card && card.classList.contains('atendida')) {
      openClinicalModal(card);
    } else {
      showToast('Solo se puede registrar historial clínico en citas marcadas como Atendida.', 'warning');
    }
  });

  dom.appointmentList?.addEventListener('change', async (e) => {
    const select = e.target.closest('.status-select');
    if (!select) return;

    const apptId = select.dataset.id;
    const newStatus = select.value;
    const card = select.closest('.appointment-card.dynamic');

    try {
      select.disabled = true;

      const res = await api.updateAppointmentStatusQuick(apptId, newStatus);
      const data = await res.json();
      select.disabled = false;

      if (!res.ok) {
        throw new Error(data.error || 'Error al actualizar el estado de la cita.');
      }

      const statusClasses = ['programada', 'en-espera', 'atendida', 'ausente'];
      statusClasses.forEach(c => {
        card.classList.remove(c);
        select.classList.remove(c);
      });

      let newClass = 'programada';
      if (newStatus === 'En Espera') newClass = 'en-espera';
      else if (newStatus === 'Atendida') newClass = 'atendida';
      else if (newStatus === 'Ausente') newClass = 'ausente';

      card.classList.add(newClass);
      select.classList.add(newClass);

      card.classList.add('recently-moved');
      card.addEventListener('animationend', () => {
        card.classList.remove('recently-moved');
      }, { once: true });

      const allCards = document.querySelectorAll('.appointment-card.dynamic');
      const total = allCards.length;
      let confirmedCount = 0;
      let pendingCount = 0;
      allCards.forEach(c => {
        const selVal = c.querySelector('.status-select')?.value;
        if (selVal === 'Atendida') confirmedCount++;
        else if (selVal === 'Programada' || selVal === 'En Espera') pendingCount++;
      });
      updateStats(total, confirmedCount, pendingCount);
      showToast('Estado de la cita actualizado con éxito.', 'success');

    } catch (err) {
      select.disabled = false;
      showToast(err.message || 'Error de conexión con el servidor.', 'error');
      await loadAppointments();
    }
  });

  setupStatusModalHandlers();
  setupPatientHandlers();
  setupFichaHandlers();
  setupSettingsHandlers();
  setupReportsHandlers();
  initInventarioHandlers();
});
