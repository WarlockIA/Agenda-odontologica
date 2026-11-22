const { ZodError } = require('zod');
const AppError = require('../utils/AppError');

// Normalización de errores específicos de la base de datos o librerías externas
const handleSQLiteConstraintError = (err) => {
  if (err.message.includes('UNIQUE constraint failed')) {
    if (err.message.includes('patients.ci')) {
      return new AppError('El paciente con este CI ya se encuentra registrado', 400);
    }
    return new AppError('El registro ingresado ya existe (duplicado).', 400);
  }
  return new AppError('Error de restricción de base de datos.', 400);
};

const handleJWTError = () => new AppError('Sesión inválida. Por favor, inicie sesión de nuevo.', 401);
const handleJWTExpiredError = () => new AppError('Su sesión ha expirado. Por favor, inicie sesión nuevamente.', 401);

const sendError = (err, res) => {
  const statusCode = err.statusCode || 500;

  // Formato estandarizado solicitado por el usuario y compatibilidad con las pruebas
  res.status(statusCode).json({
    success: false,
    status: statusCode,
    message: err.message,
    error: err.message, // Mantiene compatibilidad con suites de pruebas existentes
    timestamp: new Date().toISOString(),
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack, details: err })
  });
};

module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  // Clasificar errores conocidos de la base de datos, validación o autenticación
  if (err instanceof ZodError) {
    const errorMsg = err.issues.map(e => e.message).join(', ');
    error = new AppError(errorMsg, 400);
  } else if (err.code === 'SQLITE_CONSTRAINT' || err.message.includes('constraint failed')) {
    error = handleSQLiteConstraintError(err);
  } else if (err.name === 'JsonWebTokenError') {
    error = handleJWTError();
  } else if (err.name === 'TokenExpiredError') {
    error = handleJWTExpiredError();
  }

  // Ocultar detalles técnicos de errores no operacionales en producción
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    console.error('CRITICAL ERROR 💥:', err);
    return res.status(500).json({
      success: false,
      status: 500,
      message: 'Algo salió mal en el servidor.',
      error: 'Algo salió mal en el servidor.',
      timestamp: new Date().toISOString()
    });
  }

  sendError(error, res);
};
