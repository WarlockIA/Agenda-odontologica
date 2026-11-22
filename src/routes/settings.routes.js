const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/auth');
const settingsController = require('../controllers/settings.controller');

router.get('/clinic-hours', verifyToken, settingsController.getClinicHours);
router.get('/clinic-profile', verifyToken, settingsController.getClinicProfile);
router.put('/clinic-profile', verifyToken, settingsController.updateClinicProfile);

module.exports = router;
