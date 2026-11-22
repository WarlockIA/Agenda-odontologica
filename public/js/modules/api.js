// api.js — Cliente API de Peticiones Fetch
export const api = {
  // 1. Autenticación
  async verifySession() {
    const res = await fetch('/api/auth/verify', { headers: { 'Accept': 'application/json' } });
    if (!res.ok) throw new Error('Sesión no válida.');
    return res.json();
  },

  async logout() {
    return fetch('/api/auth/logout', { method: 'POST' });
  },

  // 2. Citas
  async getAppointments(date) {
    const res = await fetch(`/api/appointments?date=${date}`);
    if (!res.ok) throw new Error('Error al obtener las citas.');
    return res.json();
  },

  async getAppointmentsRange(start, end) {
    const res = await fetch(`/api/appointments?start_date=${start}&end_date=${end}`);
    if (!res.ok) throw new Error('Error al obtener las citas semanales.');
    return res.json();
  },

  async saveAppointment(id, body) {
    const url = id ? `/api/appointments/${id}` : '/api/appointments';
    const method = id ? 'PUT' : 'POST';
    return fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async patchAppointment(id, body) {
    return fetch(`/api/appointments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async updateAppointmentStatus(id, status) {
    return fetch(`/api/appointments/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  },

  async updateAppointmentStatusQuick(id, estado) {
    return fetch(`/api/citas/${id}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
  },

  async cancelAppointment(id) {
    return fetch(`/api/appointments/${id}/cancel`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    });
  },

  // 3. Catálogo de Tratamientos y Historial Clínico
  async getTreatments(soloActivos = true) {
    const res = await fetch(`/api/tratamientos?soloActivos=${soloActivos}`);
    if (!res.ok) throw new Error('Error al obtener tratamientos.');
    return res.json();
  },

  async createTreatment(body) {
    return fetch('/api/tratamientos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async updateTreatment(id, body) {
    return fetch(`/api/tratamientos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async deleteTreatment(id) {
    return fetch(`/api/tratamientos/${id}`, {
      method: 'DELETE'
    });
  },

  async getTreatmentUsage(id) {
    const res = await fetch(`/api/tratamientos/${id}/uso`);
    if (!res.ok) throw new Error('Error al obtener uso del tratamiento.');
    return res.json();
  },

  async getClinicalHistory(apptId) {
    const res = await fetch(`/api/citas/${apptId}/historial`);
    if (!res.ok) throw new Error('Error al obtener historial.');
    return res.json();
  },

  async saveClinicalHistory(apptId, observaciones, tratamiento_ids) {
    return fetch(`/api/citas/${apptId}/historial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ observaciones, tratamiento_ids })
    });
  },

  // 4. Pacientes
  async getPatients() {
    const res = await fetch('/api/pacientes');
    if (!res.ok) throw new Error('Error al obtener lista de pacientes.');
    return res.json();
  },

  async savePatient(body) {
    return fetch('/api/pacientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async searchPatients(query) {
    const res = await fetch(`/api/pacientes/buscar?q=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Error al buscar pacientes.');
    return res.json();
  },

  async checkCiAvailability(ci) {
    const res = await fetch(`/api/pacientes/check-ci?ci=${encodeURIComponent(ci)}`);
    if (!res.ok) throw new Error('Error al validar CI.');
    return res.json();
  },

  async getChronologicalHistory(patientId) {
    return fetch(`/api/pacientes/${patientId}/historial-cronologico`);
  },

  // 5. Configuración de Horarios
  async getSettings() {
    const res = await fetch('/api/configuracion/horarios');
    if (!res.ok) throw new Error('Error al cargar horarios.');
    return res.json();
  },

  async saveSettings(horarios) {
    return fetch('/api/configuracion/horarios', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ horarios })
    });
  },

  async getClinicHours() {
    return fetch('/api/settings/clinic-hours');
  },

  async getClinicProfile() {
    return fetch('/api/settings/clinic-profile');
  },

  async saveClinicProfile(body) {
    return fetch('/api/settings/clinic-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  // 6. Ficha Clínica
  async getFichaClinica(patientId) {
    return fetch(`/api/pacientes/${patientId}/ficha-clinica`);
  },

  async saveFichaDetails(patientId, body) {
    return fetch(`/api/pacientes/${patientId}/ficha-clinica`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async addEvolucion(patientId, body) {
    return fetch(`/api/pacientes/${patientId}/evolucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async deleteEvolucion(rowId) {
    return fetch(`/api/pacientes/evolucion/${rowId}`, {
      method: 'DELETE'
    });
  },

  // 6.1. Archivos Adjuntos
  async getAttachments(patientId) {
    return fetch(`/api/pacientes/${patientId}/attachments`);
  },

  async uploadAttachment(patientId, body) {
    return fetch(`/api/pacientes/${patientId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async deleteAttachment(id) {
    return fetch(`/api/pacientes/attachments/${id}`, {
      method: 'DELETE'
    });
  },

  // 7. Reportes
  async getFinancialReports(period = 'este_mes', startDate = '', endDate = '') {
    let url = `/api/reportes/financiero?period=${period}`;
    if (period === 'custom' && startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }
    return fetch(url);
  },

  async getSuggestFichaNro() {
    return fetch('/api/pacientes/next-ficha-nro');
  },

  // 8. Feriados y Excepciones de Horario
  async getExceptions() {
    return fetch('/api/configuracion/exceptions');
  },

  async createException(body) {
    return fetch('/api/configuracion/exceptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async updateException(id, body) {
    return fetch(`/api/configuracion/exceptions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
  },

  async deleteException(id) {
    return fetch(`/api/configuracion/exceptions/${id}`, {
      method: 'DELETE'
    });
  },

  // 9. Copia de Seguridad / Backup
  async getBackupInfo() {
    return fetch('/api/configuracion/backup/info');
  },

  async restoreBackup(fileData) {
    return fetch('/api/configuracion/backup/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fileData })
    });
  }
};
