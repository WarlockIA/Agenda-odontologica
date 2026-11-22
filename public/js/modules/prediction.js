const form = document.getElementById('prediction-form');
const treatmentSelect = document.getElementById('prediction-treatment');
const statusMessage = document.getElementById('prediction-form-status');
const submitButton = document.getElementById('prediction-submit');
const submitLabel = document.getElementById('prediction-submit-label');
const spinner = document.getElementById('prediction-spinner');
const resultPanel = document.getElementById('prediction-result');
const patientSearch = document.getElementById('prediction-patient-search');
const patientResults = document.getElementById('prediction-patient-results');
const selectedPatientLabel = document.getElementById('prediction-selected-patient');
const clearPatientButton = document.getElementById('prediction-clear-patient');
const dateInput = document.getElementById('prediction-date');
const ageInput = document.getElementById('prediction-age');
const sexInput = document.getElementById('prediction-sex');
const previousAppointmentsInput = document.getElementById('prediction-previous-appointments');
const previousAbsencesInput = document.getElementById('prediction-previous-absences');
const previousAttendancesInput = document.getElementById('prediction-previous-attendances');
const daysSincePreviousInput = document.getElementById('prediction-days-since-previous');

let selectedPatientId = null;
let patientFeaturesLoaded = false;
let loadingPatientFeatures = false;
let patientSearchTimer = null;
let patientSearchSequence = 0;
let patientFeaturesSequence = 0;

function formatPercent(value) {
  return `${(value * 100).toLocaleString('es-BO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })}%`;
}

function setStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', isError);
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading
    || (selectedPatientId !== null && (!patientFeaturesLoaded || loadingPatientFeatures));
  spinner.hidden = !isLoading;
  submitLabel.textContent = isLoading ? 'Calculando...' : 'Calcular predicción';
}

async function loadPredictionTreatments() {
  const response = await fetch('/api/tratamientos?soloActivos=true');
  if (!response.ok) {
    throw new Error('No se pudo cargar el catálogo de tratamientos.');
  }

  const data = await response.json();
  const treatments = data.treatments || [];
  treatmentSelect.replaceChildren();

  if (treatments.length === 0) {
    treatmentSelect.add(new Option('No hay tratamientos activos', ''));
    submitButton.disabled = true;
    throw new Error('Registre un tratamiento activo antes de usar la predicción.');
  }

  treatmentSelect.add(new Option('Seleccione un tratamiento', ''));
  treatments.forEach((treatment) => {
    treatmentSelect.add(new Option(treatment.nombre, String(treatment.id)));
  });
  setLoading(false);
}

function renderPrediction(result) {
  const probabilityAttendance = Math.min(1, Math.max(0, result.probabilityOfAttendance));
  const probabilityAbsence = Math.min(1, Math.max(0, result.probabilityOfAbsence));

  document.getElementById('prediction-label').textContent = result.prediction;
  document.getElementById('prediction-attendance-value').textContent = formatPercent(probabilityAttendance);
  document.getElementById('prediction-absence-value').textContent = formatPercent(probabilityAbsence);
  document.getElementById('prediction-attendance-bar').style.width = `${probabilityAttendance * 100}%`;
  document.getElementById('prediction-absence-bar').style.width = `${probabilityAbsence * 100}%`;

  resultPanel.hidden = false;
  resultPanel.classList.remove('is-visible');
  void resultPanel.offsetWidth;
  resultPanel.classList.add('is-visible');
}

function resetPatientFields() {
  ageInput.value = '';
  ageInput.readOnly = false;
  sexInput.value = '';
  sexInput.disabled = false;
  previousAppointmentsInput.value = '0';
  previousAbsencesInput.value = '0';
  previousAttendancesInput.value = '0';
  daysSincePreviousInput.value = '0';
  [
    previousAppointmentsInput,
    previousAbsencesInput,
    previousAttendancesInput,
    daysSincePreviousInput
  ].forEach((input) => {
    input.readOnly = false;
  });
}

function renderPatientResults(patients) {
  patientResults.replaceChildren();
  if (patients.length === 0) {
    const emptyResult = document.createElement('p');
    emptyResult.textContent = 'No se encontraron pacientes con ese nombre.';
    patientResults.append(emptyResult);
    patientResults.hidden = false;
    return;
  }

  patients.forEach((patient) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = patient.nombre_completo;
    option.addEventListener('click', () => selectPatient(patient));
    patientResults.append(option);
  });
  patientResults.hidden = false;
}

async function searchPatients(query, sequence) {
  try {
    const response = await fetch(`/api/reportes/prediccion/pacientes?q=${encodeURIComponent(query)}`);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || 'No se pudo buscar el paciente.');
    }
    if (sequence !== patientSearchSequence) return;
    renderPatientResults(data.patients || []);
  } catch (error) {
    if (sequence === patientSearchSequence) {
      patientResults.replaceChildren();
      patientResults.hidden = true;
      setStatus(error.message || 'No se pudo buscar el paciente.', true);
    }
  }
}

async function loadRegisteredPatientFeatures() {
  if (!selectedPatientId || !dateInput.value) return;

  const patientId = selectedPatientId;
  const appointmentDate = dateInput.value;
  const sequence = ++patientFeaturesSequence;
  loadingPatientFeatures = true;
  patientFeaturesLoaded = false;
  setLoading(false);
  setStatus('Cargando los datos registrados del paciente...');

  try {
    const url = `/api/reportes/prediccion/pacientes/${patientId}/datos?appointmentDate=${encodeURIComponent(appointmentDate)}`;
    const response = await fetch(url);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || 'No se pudieron cargar los datos del paciente.');
    }
    if (
      sequence !== patientFeaturesSequence
      || patientId !== selectedPatientId
      || appointmentDate !== dateInput.value
    ) return;

    const features = data.features;
    ageInput.value = features.age ?? '';
    ageInput.readOnly = features.age !== null;
    sexInput.value = features.sex || '';
    sexInput.disabled = Boolean(features.sex);
    previousAppointmentsInput.value = String(features.previousAppointments);
    previousAbsencesInput.value = String(features.previousAbsences);
    previousAttendancesInput.value = String(features.previousAttendances);
    daysSincePreviousInput.value = String(features.daysSincePrevious);
    [
      previousAppointmentsInput,
      previousAbsencesInput,
      previousAttendancesInput,
      daysSincePreviousInput
    ].forEach((input) => {
      input.readOnly = features.hasPreviousAppointments;
    });

    patientFeaturesLoaded = true;
    const missing = [];
    if (features.age === null) missing.push('edad');
    if (!features.sex) missing.push('sexo');
    if (!features.hasPreviousAppointments) {
      missing.push('historial de citas');
    }
    setStatus(missing.length
      ? `Complete manualmente ${missing.join(', ')} porque no hay datos vinculados suficientes.`
      : 'Edad, sexo e historial cargados desde la ficha del paciente.');
  } catch (error) {
    if (sequence === patientFeaturesSequence) {
      setStatus(error.message || 'No se pudieron cargar los datos del paciente.', true);
    }
  } finally {
    if (sequence === patientFeaturesSequence) {
      loadingPatientFeatures = false;
      setLoading(false);
    }
  }
}

function selectPatient(patient) {
  clearTimeout(patientSearchTimer);
  patientSearchSequence += 1;
  selectedPatientId = Number(patient.id);
  patientFeaturesLoaded = false;
  resetPatientFields();
  selectedPatientLabel.textContent = `Paciente seleccionado: ${patient.nombre_completo}`;
  clearPatientButton.hidden = false;
  patientSearch.value = '';
  patientResults.replaceChildren();
  patientResults.hidden = true;
  resultPanel.hidden = true;
  if (dateInput.value) {
    loadRegisteredPatientFeatures();
  } else {
    setStatus('Seleccione la fecha de la cita para cargar los datos del paciente.');
    setLoading(false);
  }
}

function clearPatientSelection() {
  if (selectedPatientId === null) return;
  selectedPatientId = null;
  patientFeaturesSequence += 1;
  patientFeaturesLoaded = false;
  loadingPatientFeatures = false;
  selectedPatientLabel.textContent = '';
  clearPatientButton.hidden = true;
  resetPatientFields();
  resultPanel.hidden = true;
  setStatus('Complete los datos manualmente o seleccione otro paciente.');
  setLoading(false);
}

export async function setupPredictionHandlers() {
  if (!form) return;

  sexInput.value = 'M';
  const today = new Date();
  dateInput.value = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0')
  ].join('-');

  clearPatientButton.addEventListener('click', () => {
    clearPatientSelection();
    patientSearchSequence += 1;
    clearTimeout(patientSearchTimer);
    patientSearch.value = '';
    patientResults.replaceChildren();
    patientResults.hidden = true;
    patientSearch.focus();
  });

  patientSearch.addEventListener('input', () => {
    clearPatientSelection();
    clearTimeout(patientSearchTimer);
    const query = patientSearch.value.trim();
    const sequence = ++patientSearchSequence;
    patientResults.replaceChildren();
    patientResults.hidden = true;

    if (query.length < 3) return;
    patientSearchTimer = setTimeout(() => searchPatients(query, sequence), 250);
  });

  patientSearch.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      patientResults.replaceChildren();
      patientResults.hidden = true;
    }
  });

  dateInput.addEventListener('change', () => {
    resultPanel.hidden = true;
    if (selectedPatientId !== null) {
      if (dateInput.value) {
        loadRegisteredPatientFeatures();
      } else {
        patientFeaturesSequence += 1;
        loadingPatientFeatures = false;
        patientFeaturesLoaded = false;
        setStatus('Seleccione la fecha de la cita para cargar los datos del paciente.');
        setLoading(false);
      }
    }
  });

  try {
    await loadPredictionTreatments();
    setStatus('');
  } catch (error) {
    setStatus(error.message, true);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (selectedPatientId !== null && !patientFeaturesLoaded) {
      setStatus('Espere a que se carguen los datos del paciente seleccionado.', true);
      return;
    }
    if (!form.reportValidity()) return;

    setLoading(true);
    setStatus('Calculando la estimación...');
    resultPanel.hidden = true;

    const payload = {
      patientId: selectedPatientId ?? undefined,
      appointmentDate: dateInput.value,
      appointmentTime: document.getElementById('prediction-time').value,
      treatmentId: Number(treatmentSelect.value),
      sex: sexInput.value,
      age: Number(ageInput.value),
      previousAppointments: Number(previousAppointmentsInput.value),
      previousAbsences: Number(previousAbsencesInput.value),
      previousAttendances: Number(previousAttendancesInput.value),
      daysSincePrevious: Number(daysSincePreviousInput.value),
      cost: Number(document.getElementById('prediction-cost').value),
    };

    try {
      const response = await fetch('/api/reportes/prediccion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || result.error || 'No se pudo calcular la predicción.');
      }

      renderPrediction(result);
      setStatus('Estimación calculada. No es una recomendación para decisiones reales.');
    } catch (error) {
      setStatus(error.message || 'Ocurrió un error al calcular la predicción.', true);
    } finally {
      setLoading(false);
    }
  });
}
