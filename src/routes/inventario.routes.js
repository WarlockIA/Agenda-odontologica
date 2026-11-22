const express = require('express');
const router = express.Router();
const { verifyToken, checkRole } = require('../middleware/auth');
const inventarioController = require('../controllers/inventario.controller');

// CRUD Catálogo (Items)
router.get('/items', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.getItems);
router.post('/items', verifyToken, checkRole('odontologo'), inventarioController.createItem);
router.put('/items/:id', verifyToken, checkRole('odontologo'), inventarioController.updateItem);
router.delete('/items/:id', verifyToken, checkRole('odontologo'), inventarioController.deleteItem);

// Proveedores
router.get('/suppliers', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.getSuppliers);
router.post('/suppliers', verifyToken, checkRole('odontologo'), inventarioController.createSupplier);
router.put('/suppliers/:id', verifyToken, checkRole('odontologo'), inventarioController.updateSupplier);
router.delete('/suppliers/:id', verifyToken, checkRole('odontologo'), inventarioController.deleteSupplier);

// Transacciones y Lotes
router.post('/transaction', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.registerTransaction);
router.get('/batches/:itemId', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.getBatches);

// Dashboard / Alertas
router.get('/dashboard-metrics', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.getDashboardMetrics);

// Recetas de Tratamiento (treatment_materials)
router.get('/treatment-materials/:treatmentId', verifyToken, checkRole('odontologo', 'recepcionista'), inventarioController.getTreatmentMaterials);
router.post('/treatment-materials', verifyToken, checkRole('odontologo'), inventarioController.saveTreatmentMaterials);

module.exports = router;
