const express = require('express');
const router = express.Router();

const { verifyToken, checkRole } = require('../middleware/auth');
const pacientesController = require('../controllers/pacientes.controller');
const fichaClinicaController = require('../controllers/fichaClinica.controller');
const attachmentsController = require('../controllers/attachments.controller');

const validateSchema = require('../middleware/validate');
const { createPatientSchema } = require('../schemas/pacientes.schema');

router.get('/buscar', verifyToken, checkRole('odontologo', 'recepcionista'), pacientesController.buscarPacientes);
router.get('/check-ci', verifyToken, checkRole('odontologo', 'recepcionista'), pacientesController.checkCiDuplicated);
router.get('/next-ficha-nro', verifyToken, checkRole('odontologo', 'recepcionista'), pacientesController.sugerirSiguienteFichaNro);
router.post('/', verifyToken, checkRole('odontologo', 'recepcionista'), validateSchema(createPatientSchema), pacientesController.registrarPaciente);
router.get('/', verifyToken, checkRole('odontologo', 'recepcionista'), pacientesController.listarPacientes);
router.get('/:id/historial-cronologico', verifyToken, checkRole('odontologo', 'recepcionista'), pacientesController.obtenerHistorialCronologico);

// Endpoints para Ficha Clínica Digital y Evolución Financiera
router.get('/:id/ficha-clinica', verifyToken, checkRole('odontologo', 'recepcionista'), fichaClinicaController.getFichaClinica);
router.put('/:id/ficha-clinica', verifyToken, checkRole('odontologo', 'recepcionista'), fichaClinicaController.updateFichaClinica);
router.post('/:id/evolucion', verifyToken, checkRole('odontologo', 'recepcionista'), fichaClinicaController.addEvolucionTratamiento);
router.delete('/evolucion/:id', verifyToken, checkRole('odontologo', 'recepcionista'), fichaClinicaController.deleteEvolucionTratamiento);

// Endpoints para Archivos Adjuntos y Radiografías
router.get('/:id/attachments', verifyToken, checkRole('odontologo', 'recepcionista'), attachmentsController.listAttachments);
router.post('/:id/attachments', verifyToken, checkRole('odontologo', 'recepcionista'), attachmentsController.uploadAttachment);
router.delete('/attachments/:id', verifyToken, checkRole('odontologo', 'recepcionista'), attachmentsController.deleteAttachment);

module.exports = router;
