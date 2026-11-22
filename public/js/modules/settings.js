// settings.js — Configuración de Horarios de la Clínica
import { dom } from './dom.js';
import { state } from './state.js';
import { api } from './api.js';
import { showAlertEl, hideAlertEl, showToast, showConfirmModal } from './ui.js';
import { loadAndRenderTreatments, setupTreatmentsHandlers } from './tratamientos.js?v=7';
import { escapeHtml } from './utils.js';

let editingExceptionId = null;

function toggleDayInputs(day, active) {
  const mStart = document.getElementById(`settings-day-m-start-${day}`);
  const mEnd = document.getElementById(`settings-day-m-end-${day}`);
  const tStart = document.getElementById(`settings-day-t-start-${day}`);
  const tEnd = document.getElementById(`settings-day-t-end-${day}`);

  if (active) {
    mStart?.removeAttribute('disabled');
    mEnd?.removeAttribute('disabled');
    tStart?.removeAttribute('disabled');
    tEnd?.removeAttribute('disabled');
    
    // Valores comerciales por defecto si están vacíos
    if (mStart && !mStart.value) mStart.value = '08:00';
    if (mEnd && !mEnd.value) mEnd.value = '12:00';
    if (tStart && !tStart.value) tStart.value = '14:00';
    if (tEnd && !tEnd.value) tEnd.value = '18:00';
  } else {
    mStart?.setAttribute('disabled', '');
    mEnd?.setAttribute('disabled', '');
    tStart?.setAttribute('disabled', '');
    tEnd?.setAttribute('disabled', '');
  }
}

export async function loadAndRenderExceptions() {
  if (!dom.exceptionsTableBody) return;

  dom.exceptionsTableBody.innerHTML = `
    <tr>
      <td colspan="3" style="text-align: center; padding: 20px;">
        <span class="spinner" style="border-width: 2px; width: 16px; height: 16px; border-color: rgba(255,255,255,0.1); border-top-color: var(--success); display: inline-block;"></span>
        <span style="margin-left: 8px; color: var(--text-muted); font-size: 13px;">Cargando feriados...</span>
      </td>
    </tr>
  `;

  try {
    const res = await api.getExceptions();
    if (!res.ok) throw new Error('Error al obtener feriados/excepciones.');
    const data = await res.json();
    const exceptions = data.exceptions || [];

    dom.exceptionsTableBody.innerHTML = '';
    if (exceptions.length === 0) {
      dom.exceptionsTableBody.innerHTML = `
        <tr>
          <td colspan="3" style="text-align: center; padding: 20px; color: var(--text-muted); font-style: italic;">No hay feriados o excepciones registradas.</td>
        </tr>
      `;
      return;
    }

    exceptions.forEach(ex => {
      const tr = document.createElement('tr');
      const [yyyy, mm, dd] = ex.exception_date.split('-');
      const formattedDate = `${dd}/${mm}/${yyyy}`;
      const isRecurringBadge = ex.is_recurring ? '<span class="recurring-badge" style="font-size: 10px; font-weight: 700; background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.25); padding: 2px 6px; border-radius: 12px; margin-left: 6px; text-transform: uppercase; vertical-align: middle; letter-spacing: 0.3px;">Anual</span>' : '';

      tr.innerHTML = `
        <td style="padding: 8px 10px; font-weight: 500; color: var(--success); white-space: nowrap;">${escapeHtml(formattedDate)}${isRecurringBadge}</td>
        <td style="padding: 8px 10px; color: var(--text-primary);">${escapeHtml(ex.description)}</td>
        <td style="padding: 8px 10px; text-align: center; width: 80px;">
          <div style="display: flex; gap: 6px; justify-content: center; align-items: center;">
            <button type="button" class="btn-edit-exception" data-id="${ex.id}" data-date="${ex.exception_date}" data-description="${escapeHtml(ex.description)}" data-recurring="${ex.is_recurring ? 1 : 0}" title="Editar feriado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4z"></path>
              </svg>
            </button>
            <button type="button" class="btn-delete-exception" data-id="${ex.id}" title="Eliminar feriado">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </td>
      `;
      dom.exceptionsTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);
    dom.exceptionsTableBody.innerHTML = `
      <tr>
        <td colspan="3" style="text-align: center; padding: 20px; color: var(--danger);">Error al cargar los feriados.</td>
      </tr>
    `;
  }
}

export async function loadSettings() {
  if (!dom.tabSettingsContent) return;
  
  const settingsAlert = document.getElementById('settings-alert');
  const settingsAlertText = document.getElementById('settings-alert-text');
  const settingsSuccess = document.getElementById('settings-success');
  
  hideAlertEl(settingsAlert);
  hideAlertEl(settingsSuccess);
  
  try {
    const data = await api.getSettings();
    const horarios = data.horarios || [];
    
    horarios.forEach(h => {
      const chk = document.getElementById(`settings-day-active-${h.day_of_week}`);
      const mStart = document.getElementById(`settings-day-m-start-${h.day_of_week}`);
      const mEnd = document.getElementById(`settings-day-m-end-${h.day_of_week}`);
      const tStart = document.getElementById(`settings-day-t-start-${h.day_of_week}`);
      const tEnd = document.getElementById(`settings-day-t-end-${h.day_of_week}`);

      if (chk) chk.checked = h.activo === 1;
      if (mStart) mStart.value = h.mañana_inicio || '';
      if (mEnd) mEnd.value = h.mañana_fin || '';
      if (tStart) tStart.value = h.tarde_inicio || '';
      if (tEnd) tEnd.value = h.tarde_fin || '';

      toggleDayInputs(h.day_of_week, h.activo === 1);
    });
    
  } catch (err) {
    console.error(err.message);
    if (settingsAlertText) settingsAlertText.textContent = err.message;
    showAlertEl(settingsAlert);
  }

  // Cargar y renderizar la tabla del catálogo de tratamientos
  await loadAndRenderTreatments();

  // Cargar y renderizar las excepciones/feriados
  await loadAndRenderExceptions();

  // Establecer fecha mínima para el selector de feriados (hoy)
  if (dom.exceptionDate) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dom.exceptionDate.min = `${yyyy}-${mm}-${dd}`;
  }
}

export function setupSettingsHandlers() {
  const settingsForm = document.getElementById('settings-form');
  const settingsAlert = document.getElementById('settings-alert');
  const settingsAlertText = document.getElementById('settings-alert-text');
  const settingsSuccess = document.getElementById('settings-success');
  const settingsSpinner = document.getElementById('settings-spinner');

  // Lógica de navegación por pestañas (Tabs)
  const tabBtns = document.querySelectorAll('.settings-tab-btn');
  const tabPanes = document.querySelectorAll('.settings-tab-pane');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remover clase active de todos los botones y paneles
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      // Añadir clase active al botón clickeado y a su panel objetivo
      btn.classList.add('active');
      const targetId = btn.getAttribute('data-target');
      const targetPane = document.getElementById(targetId);
      if (targetPane) {
        targetPane.classList.add('active');
      }
    });
  });

  // Enlazar checkboxes
  for (let d = 0; d <= 6; d++) {
    const chk = document.getElementById(`settings-day-active-${d}`);
    chk?.addEventListener('change', (e) => {
      const active = e.target.checked;
      toggleDayInputs(d, active);
    });
  }

  // Form submit
  settingsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();

    hideAlertEl(settingsAlert);
    hideAlertEl(settingsSuccess);
    settingsSpinner?.removeAttribute('hidden');

    const horarios = [];
    for (let d = 0; d <= 6; d++) {
      const chk = document.getElementById(`settings-day-active-${d}`);
      const mStart = document.getElementById(`settings-day-m-start-${d}`);
      const mEnd = document.getElementById(`settings-day-m-end-${d}`);
      const tStart = document.getElementById(`settings-day-t-start-${d}`);
      const tEnd = document.getElementById(`settings-day-t-end-${d}`);

      const activo = chk ? chk.checked : false;

      // Validar si está activo, las horas deben estar especificadas
      if (activo) {
        if (!mStart?.value || !mEnd?.value || !tStart?.value || !tEnd?.value) {
          settingsSpinner?.setAttribute('hidden', '');
          if (settingsAlertText) settingsAlertText.textContent = 'Debe especificar todas las horas para los días activos.';
          showAlertEl(settingsAlert);
          return;
        }
      }

      horarios.push({
        day_of_week: d,
        activo: activo,
        mañana_inicio: activo ? mStart.value : null,
        mañana_fin: activo ? mEnd.value : null,
        tarde_inicio: activo ? tStart.value : null,
        tarde_fin: activo ? tEnd.value : null
      });
    }

    try {
      const res = await api.saveSettings(horarios);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar la configuración de horarios.');
      }

      // Limpiar cache local de horarios en state para forzar recarga al agendar
      state.clinicHours = null;

      showAlertEl(settingsSuccess);
      setTimeout(() => {
        hideAlertEl(settingsSuccess);
      }, 3000);

    } catch (err) {
      console.error(err.message);
      if (settingsAlertText) settingsAlertText.textContent = err.message;
      showAlertEl(settingsAlert);
    } finally {
      settingsSpinner?.setAttribute('hidden', '');
    }
  });

  // Deshabilitar controles de feriados si no es odontólogo
  const isDoctor = dom.profileRole && dom.profileRole.textContent.trim().toLowerCase() === 'odontologo';
  if (!isDoctor) {
    if (dom.exceptionsForm) {
      const inputs = dom.exceptionsForm.querySelectorAll('input, button');
      inputs.forEach(inp => inp.setAttribute('disabled', ''));
    }
  }

  function resetExceptionsForm() {
    editingExceptionId = null;
    if (dom.exceptionsForm) dom.exceptionsForm.reset();
    if (dom.exceptionRecurring) dom.exceptionRecurring.checked = false;
    
    if (dom.exceptionFormTitle) dom.exceptionFormTitle.textContent = 'Registrar Cierre';
    const btnText = dom.btnAddException?.querySelector('.btn-text');
    if (btnText) btnText.textContent = 'Registrar Cierre';
    
    if (dom.btnCancelException) dom.btnCancelException.style.display = 'none';
    
    if (dom.exceptionDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth() + 1).padStart(2, '0');
      const dd = String(today.getDate()).padStart(2, '0');
      dom.exceptionDate.min = `${yyyy}-${mm}-${dd}`;
    }
  }

  // Manejar el envío del formulario de feriados
  dom.exceptionsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    hideAlertEl(dom.exceptionsAlert);
    
    const dateVal = dom.exceptionDate.value;
    const descVal = dom.exceptionDescription.value.trim();
    const recurringVal = dom.exceptionRecurring ? dom.exceptionRecurring.checked : false;
    
    if (!dateVal || !descVal) {
      if (dom.exceptionsAlertText) dom.exceptionsAlertText.textContent = 'Debe ingresar la fecha y el motivo.';
      showAlertEl(dom.exceptionsAlert);
      return;
    }
    
    dom.exceptionSpinner?.removeAttribute('hidden');
    dom.btnAddException?.setAttribute('disabled', '');
    
    try {
      let res;
      if (editingExceptionId) {
        res = await api.updateException(editingExceptionId, {
          exception_date: dateVal,
          description: descVal,
          is_recurring: recurringVal
        });
      } else {
        res = await api.createException({
          exception_date: dateVal,
          description: descVal,
          is_recurring: recurringVal
        });
      }
      
      const data = await res.json();
      
      if (!res.ok) {
        throw new Error(data.error || 'Error al guardar el feriado.');
      }
      
      resetExceptionsForm();
      await loadAndRenderExceptions();
    } catch (err) {
      console.error(err);
      if (dom.exceptionsAlertText) dom.exceptionsAlertText.textContent = err.message;
      showAlertEl(dom.exceptionsAlert);
    } finally {
      dom.exceptionSpinner?.setAttribute('hidden', '');
      dom.btnAddException?.removeAttribute('disabled');
    }
  });

  // Delegar clics para editar o eliminar feriados
  dom.exceptionsTableBody?.addEventListener('click', async (e) => {
    // 1. Eliminar Feriado
    const btnDelete = e.target.closest('.btn-delete-exception');
    if (btnDelete) {
      const isDoc = dom.profileRole && dom.profileRole.textContent.trim().toLowerCase() === 'odontologo';
      if (!isDoc) {
        showToast('No tiene permisos para eliminar feriados.', 'error');
        return;
      }
      
      const id = btnDelete.dataset.id;
      showConfirmModal(
        '¿Eliminar Feriado / Cierre?',
        '¿Está seguro de que desea eliminar este feriado/cierre? El consultorio volverá a estar disponible en esta fecha.',
        true,
        async () => {
          try {
            const res = await api.deleteException(id);
            const data = await res.json();
            
            if (!res.ok) {
              throw new Error(data.error || 'Error al eliminar el feriado.');
            }
            
            if (editingExceptionId === id) {
              resetExceptionsForm();
            }
            await loadAndRenderExceptions();
          } catch (err) {
            console.error(err);
            showToast(err.message, 'error');
          }
        }
      );
      return;
    }

    // 2. Editar Feriado
    const btnEdit = e.target.closest('.btn-edit-exception');
    if (btnEdit) {
      const isDoc = dom.profileRole && dom.profileRole.textContent.trim().toLowerCase() === 'odontologo';
      if (!isDoc) {
        showToast('No tiene permisos para editar feriados.', 'error');
        return;
      }

      editingExceptionId = btnEdit.dataset.id;
      
      if (dom.exceptionDate) {
        const todayStr = new Date().toISOString().split('T')[0];
        if (btnEdit.dataset.date < todayStr && dom.exceptionDate) {
          dom.exceptionDate.removeAttribute('min');
        }
        dom.exceptionDate.value = btnEdit.dataset.date;
      }
      if (dom.exceptionDescription) {
        dom.exceptionDescription.value = btnEdit.dataset.description;
      }
      if (dom.exceptionRecurring) {
        dom.exceptionRecurring.checked = btnEdit.dataset.recurring === '1';
      }

      if (dom.exceptionFormTitle) dom.exceptionFormTitle.textContent = 'Modificar Feriado';
      const btnText = dom.btnAddException?.querySelector('.btn-text');
      if (btnText) btnText.textContent = 'Guardar Cambios';
      if (dom.btnCancelException) dom.btnCancelException.style.display = 'block';

      dom.exceptionDescription?.focus();
    }
  });

  // Manejar clic en cancelar edición
  dom.btnCancelException?.addEventListener('click', () => {
    resetExceptionsForm();
  });

  // Manejo de pestañas dentro de Configuración (Horarios, Feriados, Backup)
  document.querySelectorAll('.settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = btn.dataset.target;
      if (!targetId) return;

      document.querySelectorAll('.settings-tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.settings-tab-pane').forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const pane = document.getElementById(targetId);
      if (pane) pane.classList.add('active');

      if (targetId === 'tab-backup') {
        loadBackupInfo();
      }
    });
  });

  // Inicializar manejadores del catálogo de tratamientos y backup
  setupTreatmentsHandlers();
  setupBackupHandlers();
}

export async function loadBackupInfo() {
  const sizeEl = document.getElementById('backup-stat-size');
  const patEl = document.getElementById('backup-stat-patients');
  const apptEl = document.getElementById('backup-stat-appts');
  
  if (!sizeEl) return;

  try {
    const res = await api.getBackupInfo();
    if (!res.ok) throw new Error('No se pudo obtener información del respaldo.');
    const data = await res.json();
    if (data.success && data.info) {
      sizeEl.textContent = data.info.sizeMB;
      if (patEl) patEl.textContent = data.info.patientCount;
      if (apptEl) apptEl.textContent = data.info.appointmentCount;
    }
  } catch (err) {
    console.error('Error al cargar info de backup:', err);
  }
}

export function setupBackupHandlers() {
  const btnDownload = document.getElementById('btn-download-backup');
  const btnTriggerRestore = document.getElementById('btn-trigger-restore-backup');
  const inputRestore = document.getElementById('input-restore-backup');

  btnDownload?.addEventListener('click', () => {
    showToast('Iniciando descarga de copia de seguridad (backup)...', 'info');
    window.location.href = '/api/configuracion/backup/download';
  });

  btnTriggerRestore?.addEventListener('click', () => {
    inputRestore?.click();
  });

  inputRestore?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.db')) {
      showToast('Por favor selecciona un archivo de base de datos válido (.db).', 'error');
      inputRestore.value = '';
      return;
    }

    showToast('Restaurando copia de seguridad...', 'info');

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const fileData = reader.result;
        const res = await api.restoreBackup(fileData);
        const data = await res.json();
        
        if (!res.ok || !data.success) {
          throw new Error(data.message || 'Error al restaurar la base de datos.');
        }

        showToast('✅ Copia de seguridad restaurada con éxito.', 'success');
        await loadBackupInfo();

        setTimeout(() => {
          window.location.reload();
        }, 500);
      } catch (err) {
        console.error('Error en restauración de backup:', err);
        showToast(err.message, 'error');
      } finally {
        inputRestore.value = '';
      }
    };
    reader.readAsDataURL(file);
  });
}
