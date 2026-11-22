const express = require('express');
const router = express.Router();

const authRoutes = require('./auth.routes');
const citasRoutes = require('./citas.routes');
const pacientesRoutes = require('./pacientes.routes');
const settingsRoutes = require('./settings.routes');
const tratamientosRoutes = require('./tratamientos.routes');
const configuracionRoutes = require('./configuracion.routes');
const reportesRoutes = require('./reportes.routes');
const inventarioRoutes = require('./inventario.routes');

router.use('/auth', authRoutes);
router.use('/settings', settingsRoutes);
router.use('/pacientes', pacientesRoutes);
router.use('/tratamientos', tratamientosRoutes);
router.use('/configuracion', configuracionRoutes);
router.use('/reportes', reportesRoutes);
router.use('/inventario', inventarioRoutes);

// Las rutas de citas se montan en la raíz del router central
router.use('/', citasRoutes);

module.exports = router;

