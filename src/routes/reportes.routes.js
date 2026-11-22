const express = require('express');
const router = express.Router();

const { verifyToken, checkRole } = require('../middleware/auth');
const validateSchema = require('../middleware/validate');
const reportesController = require('../controllers/reportes.controller');
const prediccionController = require('../controllers/prediccion.controller');
const { predictAbsenteeismSchema } = require('../schemas/prediccion.schema');

// Obtener reporte financiero (Exclusivo para Odontólogo/Administrador)
router.get('/financiero', verifyToken, checkRole('odontologo'), reportesController.getFinancialReport);
router.get(
  '/prediccion/pacientes',
  verifyToken,
  checkRole('odontologo'),
  prediccionController.searchPredictionPatients
);
router.get(
  '/prediccion/pacientes/:patientId/datos',
  verifyToken,
  checkRole('odontologo'),
  prediccionController.getRegisteredPatientFeatures
);
router.post(
  '/prediccion',
  verifyToken,
  checkRole('odontologo'),
  validateSchema(predictAbsenteeismSchema),
  prediccionController.predictAbsenteeism
);

module.exports = router;
