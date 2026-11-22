const db = require('../db');
const TratamientosRepository = require('../repositories/TratamientosRepository');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { getProbabilityOfAbsence } = require('../services/ausentismoPrediction.service');
const { createPatientPredictionFeatures } = require('../services/patientPredictionFeatures.service');

function getOne(sql, params) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function getAll(sql, params) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (error, rows) => {
      if (error) reject(error);
      else resolve(rows || []);
    });
  });
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

async function getPatientPredictionFeatures(patientId, appointmentDate) {
  const patient = await getOne(
    'SELECT edad, fecha_nacimiento, sexo FROM patients WHERE id = ?',
    [patientId]
  );
  if (!patient) {
    throw new AppError('No se encontró el paciente seleccionado.', 404);
  }

  const history = await getOne(`
    SELECT
      SUM(CASE WHEN status IN ('Atendida', 'Completada', 'Ausente', 'No Asistió') THEN 1 ELSE 0 END) AS previousAppointments,
      SUM(CASE WHEN status IN ('Ausente', 'No Asistió') THEN 1 ELSE 0 END) AS previousAbsences,
      SUM(CASE WHEN status IN ('Atendida', 'Completada') THEN 1 ELSE 0 END) AS previousAttendances,
      MAX(CASE WHEN status IN ('Atendida', 'Completada', 'Ausente', 'No Asistió') THEN appointment_date END) AS lastAppointmentDate
    FROM appointments
    WHERE patient_id = ? AND appointment_date < ?
  `, [patientId, appointmentDate]);

  return createPatientPredictionFeatures(patient, history || {}, appointmentDate);
}

const searchPredictionPatients = catchAsync(async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (query.length < 3) {
    return res.status(200).json({ success: true, patients: [] });
  }

  const patients = await getAll(`
    SELECT id, nombre_completo
    FROM patients
    WHERE nombre_completo LIKE ? COLLATE NOCASE
    ORDER BY nombre_completo COLLATE NOCASE
    LIMIT 10
  `, [`%${query}%`]);

  res.status(200).json({ success: true, patients });
});

const getRegisteredPatientFeatures = catchAsync(async (req, res) => {
  const patientId = Number(req.params.patientId);
  const { appointmentDate } = req.query;
  if (!Number.isInteger(patientId) || patientId < 1 || !isValidDate(appointmentDate)) {
    throw new AppError('Seleccione un paciente y una fecha válidos.', 400);
  }

  const features = await getPatientPredictionFeatures(patientId, appointmentDate);
  res.status(200).json({ success: true, features });
});

const predictAbsenteeism = catchAsync(async (req, res) => {
  const {
    patientId,
    appointmentDate,
    appointmentTime,
    treatmentId,
    sex,
    age,
    previousAppointments,
    previousAbsences,
    previousAttendances,
    daysSincePrevious,
    cost,
  } = req.body;

  const treatment = await TratamientosRepository.findById(treatmentId);
  if (!treatment || treatment.activo !== 1) {
    throw new AppError('Seleccione un tratamiento activo.', 400);
  }

  const patientFeatures = patientId
    ? await getPatientPredictionFeatures(patientId, appointmentDate)
    : null;
  const predictionAge = patientFeatures?.age ?? age;
  const predictionSex = patientFeatures?.sex ?? sex;
  const predictionHistory = patientFeatures?.hasPreviousAppointments
    ? patientFeatures
    : {
    ...patientFeatures,
    previousAppointments,
    previousAbsences,
    previousAttendances,
    daysSincePrevious,
    };

  const [year, month, day] = appointmentDate.split('-').map(Number);
  const [hour, minute] = appointmentTime.split(':').map(Number);
  const date = new Date(year, month - 1, day);
  const hourOfDay = hour + minute / 60;
  const appointmentCount = predictionHistory.previousAppointments;

  const probabilityOfAbsence = getProbabilityOfAbsence({
    dia_semana: (date.getDay() + 6) % 7,
    mes: month,
    hora: hourOfDay,
    edad: predictionAge,
    sexo: predictionSex,
    treatment: treatment.nombre,
    categorias: treatment.categoria || 'General',
    costo: cost > 0 ? cost : treatment.costo_base,
    citas_previas: appointmentCount,
    ausencias_previas: predictionHistory.previousAbsences,
    atenciones_previas: predictionHistory.previousAttendances,
    tasa_ausencia_previa: appointmentCount > 0
      ? predictionHistory.previousAbsences / appointmentCount
      : 0,
    dias_desde_cita_anterior: predictionHistory.daysSincePrevious,
  });

  res.status(200).json({
    success: true,
    prediction: probabilityOfAbsence > 0.5 ? 'AUSENTE' : 'ATENDIDA',
    probabilityOfAbsence,
    probabilityOfAttendance: 1 - probabilityOfAbsence,
    model: 'Regresión Logística',
  });
});

module.exports = {
  getRegisteredPatientFeatures,
  predictAbsenteeism,
  searchPredictionPatients,
};
