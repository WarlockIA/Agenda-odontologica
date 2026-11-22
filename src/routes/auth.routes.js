const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();

const authController = require('../controllers/auth.controller');
const { verifyToken, checkRole } = require('../middleware/auth');

// Limitador de intentos para la ruta de Login (Prevención de Fuerza Bruta)
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 5, // Limita cada IP a 5 intentos de login por 'windowMs'
  handler: (req, res) => {
    res.status(429).json({
      error: 'Demasiados intentos de inicio de sesión. Por favor, intente de nuevo en un minuto.'
    });
  },
  standardHeaders: true,
  legacyHeaders: false,
});

const validateSchema = require('../middleware/validate');
const { loginSchema, registerSchema, forgotPasswordSchema, updateProfileSchema } = require('../schemas/auth.schema');

router.post('/login', loginLimiter, validateSchema(loginSchema), authController.login);
const registrationAccess = process.env.NODE_ENV === 'production'
  ? [verifyToken, checkRole('odontologo')]
  : [];

router.post('/register', ...registrationAccess, validateSchema(registerSchema), authController.register);
router.post('/forgot-password', validateSchema(forgotPasswordSchema), authController.forgotPassword);
router.get('/verify', verifyToken, authController.verifySession);
router.put('/profile', verifyToken, validateSchema(updateProfileSchema), authController.updateProfile);
router.post('/logout', authController.logout);

module.exports = router;
