const express = require('express');
const router = express.Router();

const { verifyToken, checkRole } = require('../middleware/auth');
const { validateSchedule } = require('../middleware/scheduleValidator');
const { checkAppointmentConflict } = require('../middleware/conflictChecker');
const { checkPastAppointment } = require('../middleware/checkPastAppointment');

const validateSchema = require('../middleware/validate');
const { createAppointmentSchema, patchAppointmentSchema } = require('../schemas/citas.schema');

const citasController = require('../controllers/citas.controller');

// Obtener citas (rango o día)
router.get('/appointments', verifyToken, citasController.getAppointments);

// Registrar cita
router.post('/appointments', verifyToken, validateSchema(createAppointmentSchema), validateSchedule, checkAppointmentConflict, citasController.createAppointment);

// Actualizar cita completa
router.put('/appointments/:id', verifyToken, checkPastAppointment, validateSchema(createAppointmentSchema), validateSchedule, checkAppointmentConflict, citasController.updateAppointment);

// Reprogramación parcial (Drag-and-Drop)
router.patch('/appointments/:id', verifyToken, checkPastAppointment, validateSchema(patchAppointmentSchema), validateSchedule, checkAppointmentConflict, citasController.patchAppointment);

// Actualizar estado estándar
router.patch('/appointments/:id/status', verifyToken, citasController.updateAppointmentStatus);

// Actualizar estado jornada rápido (whitelist)
router.patch('/citas/:id/estado', verifyToken, citasController.updateCitaEstadoRapido);

// Cancelar cita (Soft Delete)
router.patch('/appointments/:id/cancel', verifyToken, checkPastAppointment, citasController.cancelAppointment);

// Historial clínico por cita (HU-011)
router.post('/citas/:id/historial', verifyToken, checkRole('odontologo'), citasController.saveClinicalHistory);
router.get('/citas/:id/historial', verifyToken, checkRole('odontologo', 'recepcionista'), citasController.getClinicalHistory);

module.exports = router;
