const jwt = require('jsonwebtoken');

/**
 * Middleware para proteger rutas de la API mediante la verificación del JWT en las cookies.
 */
function verifyToken(req, res, next) {
  const token = req.cookies.token;

  if (!token) {
    return res.status(401).json({ error: 'No autorizado: Sesión no encontrada.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'super_secret_secure_key_1234567890_agenda_odontologica');
    req.user = decoded; // Adjuntamos los datos del token decodificado a la request
    next();
  } catch (error) {
    console.error('Error al verificar JWT:', error.message);
    
    // Si el token expiró o es inválido, limpiamos la cookie corrupta
    res.clearCookie('token', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    return res.status(401).json({ error: 'No autorizado: Sesión expirada o inválida.' });
  }
}

/**
 * Middleware para verificar si el usuario logueado tiene un rol autorizado.
 * Debe ser colocado después de verifyToken.
 */
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Acceso denegado: rol no autorizado para esta acción.' });
    }
    next();
  };
}

module.exports = {
  verifyToken,
  checkRole
};
