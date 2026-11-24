const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const { sendEmail } = require('../utils/email');

/**
 * Endpoint POST /api/auth/login
 * Autentica al usuario, mitiga ataques de sincronización (timing attacks) y genera cookie JWT HttpOnly.
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password, rememberMe } = req.body;
  const fs = require('fs');
  const path = require('path');
  
  // Usar carpeta con permisos de escritura (directorio de la base de datos en Electron o scratch en desarrollo web)
  const logDir = process.env.DB_PATH ? path.dirname(process.env.DB_PATH) : path.resolve(__dirname, '../../scratch');
  if (process.env.NODE_ENV !== 'production' && !fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  const logFile = path.join(logDir, 'login-debug.log');
  
  const log = (msg) => {
    if (process.env.NODE_ENV === 'production') return;
    const timestamp = new Date().toISOString();
    try {
      fs.appendFileSync(logFile, `[${timestamp}] ${msg}\n`);
    } catch (err) {
      console.error('Error al escribir en login-debug.log:', err.message);
    }
  };

  log(`Login request started for: ${email}`);

  // Validaciones básicas de entrada
  if (!email || !password) {
    log(`Login failed: Missing email or password`);
    throw new AppError('Correo electrónico y contraseña son obligatorios.', 400);
  }

  // Regex simple para formato de email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    log(`Login failed: Invalid email format`);
    throw new AppError('El formato del correo electrónico no es válido.', 400);
  }

  // Consulta parametrizada para evitar Inyección SQL (Promisificada)
  const sql = `SELECT users.*, authorized_users.session_version
    FROM users JOIN authorized_users ON authorized_users.user_id = users.id
    WHERE users.email = ?`;
  log(`Querying user in DB...`);
  const user = await new Promise((resolve, reject) => {
    db.get(sql, [email.trim().toLowerCase()], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });
  log(`DB query finished. User found: ${!!user}`);

  // Mitigación de ataques de tiempo (Timing Attacks):
  // Si el usuario no existe, corremos la verificación de bcrypt con un hash "dummy"
  // para que el tiempo de respuesta sea similar al de un correo existente con contraseña inválida.
  const dummyHash = '$2a$12$76fFEa/.0R5IwZpZfbhqautWLU5mO9EJqWUjwa5nnU3PJZ1gcPC9C';
  const hashToCompare = user ? user.password_hash : dummyHash;

  log(`Starting bcrypt compare...`);
  const match = await bcrypt.compare(password, hashToCompare);
  log(`Bcrypt compare finished. Match: ${match}`);

  if (!user || !match) {
    log(`Login failed: Invalid credentials`);
    // Retornamos error genérico de credenciales incorrectas para evitar enumeración de usuarios
    throw new AppError('Credenciales incorrectas, por favor intente de nuevo', 401);
  }

  // Si las credenciales son válidas, generamos el JWT
  const expiresIn = rememberMe ? '7d' : '1h';
  const cookieMaxAge = rememberMe ? 7 * 24 * 60 * 60 * 1000 : 60 * 60 * 1000;

  log(`Signing JWT...`);
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.session_version
    },
    process.env.JWT_SECRET || 'super_secret_secure_key_1234567890_agenda_odontologica',
    { expiresIn: expiresIn }
  );
  log(`JWT signed.`);

  // Enviamos el token en una Cookie HttpOnly y SameSite=Strict para evitar robos por XSS y mitigar CSRF
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: cookieMaxAge
  });
  log(`Cookie set. Sending response...`);

  // Responder con éxito y los datos mínimos del usuario (sin token en el cuerpo)
  res.status(200).json({
    message: 'Login exitoso',
    user: {
      name: user.name,
      role: user.role
    }
  });
  log(`Response sent successfully.`);
});

/**
 * Endpoint GET /api/auth/verify
 * Verifica si la sesión del usuario sigue activa
 */
const verifySession = catchAsync(async (req, res, next) => {
  res.status(200).json({
    authenticated: true,
    user: req.user
  });
});

/**
 * Endpoint POST /api/auth/forgot-password
 * Maneja la solicitud de recuperación de contraseña
 */
const forgotPassword = catchAsync(async (req, res, next) => {
  if (process.env.NODE_ENV === 'production') {
    throw new AppError('La recuperación de contraseña no está configurada para producción.', 503);
  }

  const { email } = req.body;

  // 1. Verificar si el usuario existe
  const sql = 'SELECT id, name FROM users WHERE email = ?';
  const user = await new Promise((resolve, reject) => {
    db.get(sql, [email.trim().toLowerCase()], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  // 2. Por seguridad (anti-enumeración), siempre respondemos OK,
  // incluso si el correo no existe en la BD.
  if (user) {
    // 3. Generar token de recuperación simulado (En un entorno real, guardar en DB con expiración)
    const resetToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET || 'super_secret', { expiresIn: '15m' });
    const resetLink = `http://localhost:3000/reset-password.html?token=${resetToken}`;

    // 4. Enviar correo usando Nodemailer (Ethereal Email o SMTP Real)
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eaeaea; border-radius: 10px; overflow: hidden;">
        <div style="background-color: #0f172a; padding: 20px; text-align: center;">
          <h1 style="color: #38bdf8; margin: 0;">Cristo Rey</h1>
          <p style="color: #94a3b8; margin-top: 5px;">Consultorio Odontológico</p>
        </div>
        <div style="padding: 30px; color: #333;">
          <h2>Recuperación de contraseña</h2>
          <p>Hola <strong>${user.name}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer tu contraseña. Haz clic en el botón de abajo para crear una nueva:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" style="background-color: #38bdf8; color: #fff; text-decoration: none; padding: 12px 25px; border-radius: 6px; font-weight: bold; display: inline-block;">Restablecer Contraseña</a>
          </div>
          <p style="font-size: 13px; color: #666;">Si no solicitaste esto, puedes ignorar este correo de forma segura. El enlace expirará en 15 minutos.</p>
        </div>
      </div>
    `;

    await sendEmail({
      to: email,
      subject: 'Recuperación de contraseña - Cristo Rey',
      html: emailHtml
    });
  }

  res.status(200).json({
    message: 'Si el correo existe en nuestro sistema, hemos enviado un enlace de recuperación.'
  });
});

/**
 * Endpoint POST /api/auth/logout
 * Limpia la cookie del token de sesión
 */
const logout = catchAsync(async (req, res, next) => {
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  res.status(200).json({ message: 'Sesión cerrada con éxito.' });
});

/**
 * Endpoint PUT /api/auth/profile
 * Permite al usuario autenticado actualizar su nombre, correo o contraseña
 */
const updateProfile = catchAsync(async (req, res, next) => {
  const { name, email, password } = req.body;
  const userId = req.user.id;

  // 1. Verificar si el nuevo correo ya existe (si es que lo cambió)
  const sqlCheck = 'SELECT id FROM users WHERE email = ? AND id != ?';
  const existingUser = await new Promise((resolve, reject) => {
    db.get(sqlCheck, [email.trim().toLowerCase(), userId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (existingUser) {
    throw new AppError('El correo electrónico ya está registrado por otro usuario.', 400);
  }

  // 2. Determinar si hay actualización de contraseña
  let sqlUpdate = '';
  let params = [];

  if (password && password.trim() !== '') {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);
    sqlUpdate = 'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?';
    params = [name.trim(), email.trim().toLowerCase(), passwordHash, userId];
  } else {
    sqlUpdate = 'UPDATE users SET name = ?, email = ? WHERE id = ?';
    params = [name.trim(), email.trim().toLowerCase(), userId];
  }

  // 3. Ejecutar actualización
  await new Promise((resolve, reject) => {
    db.run(sqlUpdate, params, function (err) {
      if (err) reject(err);
      else resolve();
    });
  });

  res.status(200).json({
    message: 'Perfil actualizado exitosamente.',
    user: {
      id: userId,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role: req.user.role // se mantiene el rol actual
    }
  });
});

module.exports = {
  login,
  forgotPassword,
  verifySession,
  logout,
  updateProfile
};
