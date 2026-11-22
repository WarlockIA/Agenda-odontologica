function parseIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}

function getAgeAtDate(birthDate, targetDate) {
  const birth = parseIsoDate(birthDate);
  const target = parseIsoDate(targetDate);
  if (!birth || !target || birth > target) return null;

  let age = target.getUTCFullYear() - birth.getUTCFullYear();
  if (
    target.getUTCMonth() < birth.getUTCMonth()
    || (target.getUTCMonth() === birth.getUTCMonth() && target.getUTCDate() < birth.getUTCDate())
  ) {
    age -= 1;
  }

  return age >= 1 && age <= 120 ? age : null;
}

function normalizeSex(value) {
  const sex = String(value || '').trim().toLocaleLowerCase();
  if (['m', 'masculino', 'male'].includes(sex)) return 'M';
  if (['f', 'femenino', 'female'].includes(sex)) return 'F';
  if (['otro', 'other'].includes(sex)) return 'Otro';
  return null;
}

function createPatientPredictionFeatures(patient, history, appointmentDate) {
  const previousAppointments = Math.max(0, Number(history.previousAppointments) || 0);
  const previousAbsences = Math.max(0, Number(history.previousAbsences) || 0);
  const previousAttendances = Math.max(0, Number(history.previousAttendances) || 0);
  const targetDate = parseIsoDate(appointmentDate);
  const lastDate = parseIsoDate(history.lastAppointmentDate);
  const daysSincePrevious = targetDate && lastDate && lastDate <= targetDate
    ? Math.floor((targetDate.getTime() - lastDate.getTime()) / 86400000)
    : 0;
  const storedAge = Number(patient.edad);

  return {
    age: getAgeAtDate(patient.fecha_nacimiento, appointmentDate)
      ?? (Number.isInteger(storedAge) && storedAge >= 1 && storedAge <= 120 ? storedAge : null),
    sex: normalizeSex(patient.sexo),
    previousAppointments: Math.min(500, previousAppointments),
    previousAbsences: Math.min(500, previousAbsences),
    previousAttendances: Math.min(500, previousAttendances),
    daysSincePrevious: Math.min(3650, Math.max(0, daysSincePrevious)),
    hasPreviousAppointments: previousAppointments > 0,
  };
}

module.exports = {
  createPatientPredictionFeatures,
  getAgeAtDate,
  normalizeSex,
};
