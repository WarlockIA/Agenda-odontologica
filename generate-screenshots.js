const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const screenshotsDir = path.join(__dirname, 'report_assets', 'screenshots');
if (!fs.existsSync(screenshotsDir)) {
  fs.mkdirSync(screenshotsDir, { recursive: true });
}

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_secure_key_1234567890_agenda_odontologica';

const adminToken = jwt.sign(
  { id: 1, email: 'admin@agendaodontologica.com', role: 'odontologo', name: 'Dr. Luis D. Reynaga Padilla' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const serverApp = require('./src/server.js');
const server = serverApp.listen(3009, async () => {
  console.log('Servidor auxiliar para capturas corriendo en http://localhost:3009');
  
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      width: 1366,
      height: 768,
      show: false,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    try {
      // 1. Pantalla de Login
      console.log('Capturando Pantalla 1: Login...');
      await win.loadURL('http://localhost:3009/index.html');
      await wait(1500);
      let image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '1_login.png'), image.toPNG());

      // Establecer cookie JWT
      await win.webContents.session.cookies.set({
        url: 'http://localhost:3009',
        name: 'token',
        value: adminToken,
        httpOnly: true
      });

      // 2. Pantalla de Agenda Semanal (Dashboard)
      console.log('Capturando Pantalla 2: Agenda de Citas...');
      await win.loadURL('http://localhost:3009/dashboard.html');
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '2_agenda_citas.png'), image.toPNG());

      // 3. Pantalla de Pacientes
      console.log('Capturando Pantalla 3: Pacientes...');
      await win.webContents.executeJavaScript(`document.getElementById('nav-link-patients')?.click();`);
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '3_pacientes_ficha.png'), image.toPNG());

      // 4. Pantalla de Tratamientos
      console.log('Capturando Pantalla 4: Tratamientos...');
      await win.loadURL('http://localhost:3009/dashboard.html');
      await wait(2500);
      await win.webContents.executeJavaScript(`document.getElementById('nav-tratamientos')?.click();`);
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '4_tratamientos.png'), image.toPNG());

      // 5. Pantalla de Inventario
      console.log('Capturando Pantalla 5: Inventario...');
      await win.loadURL('http://localhost:3009/dashboard.html');
      await wait(2500);
      await win.webContents.executeJavaScript(`document.getElementById('nav-link-inventario')?.click();`);
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '5_inventario.png'), image.toPNG());

      // 6. Pantalla de Reportes
      console.log('Capturando Pantalla 6: Reportes...');
      await win.loadURL('http://localhost:3009/dashboard.html');
      await wait(2500);
      await win.webContents.executeJavaScript(`document.getElementById('nav-link-reports')?.click();`);
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '6_reportes.png'), image.toPNG());

      // 7. Pantalla de Configuración
      console.log('Capturando Pantalla 7: Configuración...');
      await win.loadURL('http://localhost:3009/dashboard.html');
      await wait(2500);
      await win.webContents.executeJavaScript(`document.getElementById('nav-settings')?.click();`);
      await wait(3000);
      image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '7_configuracion.png'), image.toPNG());

      console.log('✅ Capturas de pantalla completadas exitosamente en report_assets/screenshots/');
    } catch (e) {
      console.error('Error al generar capturas:', e);
    } finally {
      win.close();
      server.close();
      app.quit();
      process.exit(0);
    }
  });
});
