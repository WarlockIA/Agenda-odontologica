const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const path = require('path');
require('dotenv').config();
const validateProductionConfig = require('./config/production');
const mountProtectedUploads = require('./middleware/protectedUploads');

const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '127.0.0.1';

if (require.main === module) {
  validateProductionConfig(process.env);
}

app.set('trust proxy', process.env.TRUST_PROXY === 'loopback' ? 'loopback' : false);

// 1. Configurar Cabeceras de Seguridad (Helmet)
// Permitimos estilos desde Google Fonts en el Content Security Policy (CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"],
      },
    },
  })
);

// 2. Parsers de Datos (Permitir carga de radiografías e imágenes de alta resolución en Base64 hasta 50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(cookieParser());

// Mantener los adjuntos fuera del acceso estático público y exigir una sesión.
const uploadDir = path.resolve(process.env.UPLOAD_PATH || path.join(__dirname, '../public/uploads'));
mountProtectedUploads(app, uploadDir);

// Servir archivos estáticos del frontend desde la carpeta "public".
app.use(express.static(path.join(__dirname, '../public')));

// 3. Montar Enrutador Central de la API
const apiRouter = require('./routes');
app.use('/api', apiRouter);

// Ruta comodín para redirigir a Login o Dashboard según corresponda si se ingresa a una ruta inexistente
app.get('*', (req, res) => {
  res.redirect('/index.html');
});

// Middleware Global de Manejo de Errores Centralizado
const errorHandler = require('./middleware/errorHandler');
app.use(errorHandler);

// Levantar el servidor
if (require.main === module) {
  app.listen(PORT, HOST, async () => {
    console.log(`===================================================`);
    console.log(` Servidor de Agenda Odontológica corriendo en:`);
    console.log(` http://${HOST}:${PORT}`);
    console.log(`===================================================`);
  });
}

module.exports = app;
