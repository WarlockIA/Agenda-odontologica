const { app, BrowserWindow, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

// Obtener rutas persistentes en el directorio del sistema del usuario (AppData/Roaming en Windows)
const userDataPath = app.getPath('userData');
const dbPath = path.join(userDataPath, 'database.db');
const uploadDir = path.join(userDataPath, 'uploads');

// Asegurar que la carpeta de subidas de usuario exista
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Si la base de datos no existe aún en AppData, copiar la base de datos inicial
if (!fs.existsSync(dbPath)) {
  const seedCandidates = [
    path.join(app.getAppPath(), 'database.db'),
    path.join(__dirname, '../database.db')
  ];
  for (const candidate of seedCandidates) {
    if (fs.existsSync(candidate)) {
      try {
        fs.copyFileSync(candidate, dbPath);
        console.log(`Base de datos inicial copiada desde ${candidate} hacia ${dbPath}`);
        break;
      } catch (err) {
        console.error('Error al copiar la base de datos inicial:', err);
      }
    }
  }
}

// Configurar variables de entorno para que las use el backend
process.env.DB_PATH = dbPath;
process.env.UPLOAD_PATH = uploadDir;

// Importar la aplicación de Express (se importa DESPUÉS de definir las variables de entorno)
const expressApp = require('./server');

let mainWindow;
let serverInstance;

function createWindow(port) {
  // Ruta al icono del diente (build/icon.ico o public/favicon.ico)
  const iconPath = fs.existsSync(path.join(__dirname, '../build/icon.ico'))
    ? path.join(__dirname, '../build/icon.ico')
    : path.join(__dirname, '../public/favicon.ico');

  // Crear la ventana principal de la aplicación de escritorio
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: "Agenda Odontológica",
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Cargar el servidor local Express
  mainWindow.loadURL(`http://localhost:${port}`);

  // Ocultar la barra de menú predeterminada de Chromium en producción
  const isDev = !app.isPackaged;
  if (!isDev) {
    Menu.setApplicationMenu(null);
  } else {
    // En desarrollo podemos abrir las herramientas de desarrollo automáticamente para depurar
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Iniciar aplicación
app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('com.agendaodontologica.app');
  }

  // Iniciar Express en el puerto 0 (el sistema operativo elegirá un puerto libre aleatorio de forma segura)
  serverInstance = expressApp.listen(0, '127.0.0.1', () => {
    const port = serverInstance.address().port;
    console.log(`===================================================`);
    console.log(` Servidor corriendo dentro de Electron en el puerto: ${port}`);
    console.log(` Base de datos persistente en: ${process.env.DB_PATH}`);
    console.log(` Directorio de adjuntos en: ${process.env.UPLOAD_PATH}`);
    console.log(`===================================================`);
    
    createWindow(port);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const port = serverInstance.address().port;
      createWindow(port);
    }
  });
});

// Detener el servidor y salir de la aplicación cuando todas las ventanas se cierren
app.on('window-all-closed', () => {
  if (serverInstance) {
    serverInstance.close();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
