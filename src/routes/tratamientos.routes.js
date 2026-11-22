const express = require('express');
const router = express.Router();

const { verifyToken, checkRole } = require('../middleware/auth');
const validateSchema = require('../middleware/validate');
const { createTreatmentSchema, updateTreatmentSchema } = require('../schemas/tratamientos.schema');
const tratamientosController = require('../controllers/tratamientos.controller');

// Obtener catálogo de tratamientos (permitido para Odontólogo y Recepcionista)
router.get('/', verifyToken, checkRole('odontologo', 'recepcionista'), tratamientosController.getTreatments);

// Registrar nuevo tratamiento (exclusivo para Odontólogo Administrador)
router.post('/', verifyToken, checkRole('odontologo'), validateSchema(createTreatmentSchema), tratamientosController.createTreatment);

// Editar tratamiento (exclusivo para Odontólogo Administrador)
router.put('/:id', verifyToken, checkRole('odontologo'), validateSchema(updateTreatmentSchema), tratamientosController.updateTreatment);

// Desactivar tratamiento / Borrado lógico (exclusivo para Odontólogo Administrador)
router.delete('/:id', verifyToken, checkRole('odontologo'), tratamientosController.deleteTreatment);

// Obtener conteo de uso histórico del tratamiento (exclusivo para Odontólogo Administrador)
router.get('/:id/uso', verifyToken, checkRole('odontologo'), tratamientosController.getTreatmentUsage);

module.exports = router;
