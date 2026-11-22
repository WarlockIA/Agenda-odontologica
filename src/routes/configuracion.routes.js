const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const configuracionController = require('../controllers/configuracion.controller');

router.get('/horarios', verifyToken, configuracionController.getHorarios);
router.put('/horarios', verifyToken, checkRole('odontologo'), configuracionController.updateHorarios);

router.get('/exceptions', verifyToken, configuracionController.getExceptions);
router.post('/exceptions', verifyToken, checkRole('odontologo'), configuracionController.createException);
router.put('/exceptions/:id', verifyToken, checkRole('odontologo'), configuracionController.updateException);
router.delete('/exceptions/:id', verifyToken, checkRole('odontologo'), configuracionController.deleteException);

// Rutas de Copia de Seguridad / Backup
router.get('/backup/info', verifyToken, configuracionController.getBackupInfo);
router.get('/backup/download', verifyToken, configuracionController.downloadBackup);
router.post('/backup/restore', verifyToken, checkRole('odontologo'), configuracionController.restoreBackup);

module.exports = router;
