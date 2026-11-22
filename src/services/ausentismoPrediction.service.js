const fs = require('fs');
const path = require('path');

const modelPath = path.resolve(
  __dirname,
  '../../Proyecto_Ciencia_de_Datos/modelos/regresion_logistica_node.json'
);
const model = JSON.parse(fs.readFileSync(modelPath, 'utf8'));

function getProbabilityOfAbsence(features) {
  const { names, medians, means, scales } = model.numericFeatures;
  const { names: categoricalNames, imputers, categories } = model.categoricalFeatures;
  let score = model.intercept;
  let coefficientIndex = 0;

  names.forEach((name, index) => {
    const rawValue = features[name];
    const value = rawValue === null || rawValue === undefined
      ? medians[index]
      : Number(rawValue);

    if (!Number.isFinite(value)) {
      throw new TypeError(`El valor numérico ${name} no es válido.`);
    }

    score += ((value - means[index]) / scales[index]) * model.coefficients[coefficientIndex];
    coefficientIndex += 1;
  });

  categoricalNames.forEach((name, featureIndex) => {
    const rawValue = features[name];
    const value = rawValue === null || rawValue === undefined
      ? imputers[featureIndex]
      : String(rawValue);
    const categoryIndex = categories[featureIndex].indexOf(value);

    if (categoryIndex !== -1) {
      score += model.coefficients[coefficientIndex + categoryIndex];
    }

    coefficientIndex += categories[featureIndex].length;
  });

  if (!Number.isFinite(score) || coefficientIndex !== model.coefficients.length) {
    throw new Error('El artefacto del modelo tiene una estructura inválida.');
  }

  if (score >= 0) {
    return 1 / (1 + Math.exp(-score));
  }

  const expScore = Math.exp(score);
  return expScore / (1 + expScore);
}

module.exports = { getProbabilityOfAbsence };
