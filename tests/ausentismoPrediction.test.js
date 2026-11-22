const test = require('node:test');
const assert = require('node:assert/strict');
const { getProbabilityOfAbsence } = require('../src/services/ausentismoPrediction.service');

const sample = {
  dia_semana: 2,
  mes: 11,
  hora: 9.5,
  edad: 30,
  sexo: 'M',
  treatment: 'Limpieza Dental',
  categorias: 'Preventiva',
  costo: 50,
  citas_previas: 0,
  ausencias_previas: 0,
  atenciones_previas: 0,
  tasa_ausencia_previa: 0,
  dias_desde_cita_anterior: 0,
};

test('reproduce una inferencia determinista del modelo exportado', () => {
  const probability = getProbabilityOfAbsence(sample);
  assert.ok(Math.abs(probability - 0.6383692762794955) < 1e-12);
});

test('ignora categorías de tratamiento desconocidas como el pipeline entrenado', () => {
  const probability = getProbabilityOfAbsence({
    ...sample,
    treatment: 'Tratamiento no incluido en el entrenamiento',
    categorias: 'Categoría no incluida',
  });

  assert.ok(Number.isFinite(probability));
  assert.ok(probability >= 0 && probability <= 1);
});

test('rechaza valores numéricos no válidos', () => {
  assert.throws(
    () => getProbabilityOfAbsence({ ...sample, edad: Number.NaN }),
    /edad no es válido/
  );
});
