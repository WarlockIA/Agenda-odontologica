const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createPatientPredictionFeatures,
  getAgeAtDate,
  normalizeSex,
} = require('../src/services/patientPredictionFeatures.service');

test('builds a registered patient prediction profile as of the appointment date', () => {
  const features = createPatientPredictionFeatures(
    { fecha_nacimiento: '1995-11-26', edad: 31, sexo: 'Femenino' },
    {
      previousAppointments: 4,
      previousAbsences: 1,
      previousAttendances: 3,
      lastAppointmentDate: '2026-11-20',
    },
    '2026-11-25'
  );

  assert.deepEqual(features, {
    age: 30,
    sex: 'F',
    previousAppointments: 4,
    previousAbsences: 1,
    previousAttendances: 3,
    daysSincePrevious: 5,
    hasPreviousAppointments: true,
  });
});

test('uses stored age when birth date is missing and normalizes recorded sex', () => {
  assert.equal(getAgeAtDate('1995-11-26', '2026-11-26'), 31);
  assert.equal(normalizeSex('Masculino'), 'M');

  const features = createPatientPredictionFeatures(
    { fecha_nacimiento: null, edad: 42, sexo: 'Masculino' },
    {},
    '2026-11-25'
  );
  assert.equal(features.age, 42);
  assert.equal(features.sex, 'M');
  assert.equal(features.daysSincePrevious, 0);
  assert.equal(features.hasPreviousAppointments, false);
});
