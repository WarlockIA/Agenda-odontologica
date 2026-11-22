const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');

const screenshotsDir = path.join(__dirname, 'report_assets', 'screenshots');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_secure_key_1234567890_agenda_odontologica';

const adminToken = jwt.sign(
  { id: 1, email: 'admin@agendaodontologica.com', role: 'odontologo', name: 'Dr. Luis D. Reynaga Padilla' },
  JWT_SECRET,
  { expiresIn: '1h' }
);

const serverApp = require('./src/server.js');
const server = serverApp.listen(3015, async () => {
  app.whenReady().then(async () => {
    const win = new BrowserWindow({
      width: 1366,
      height: 768,
      show: false,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });

    const wait = (ms) => new Promise(res => setTimeout(res, ms));

    try {
      await win.webContents.session.cookies.set({
        url: 'http://localhost:3015',
        name: 'token',
        value: adminToken,
        httpOnly: true
      });

      await win.loadURL('http://localhost:3015/dashboard.html');
      await wait(2500);

      // Clic en reportes
      await win.webContents.executeJavaScript(`
        const btn = document.getElementById('nav-link-reports');
        if(btn) {
          btn.click();
        }
      `);
      await wait(3000);

      const image = await win.webContents.capturePage();
      fs.writeFileSync(path.join(screenshotsDir, '5_reportes.png'), image.toPNG());
      console.log('✅ 5_reportes.png generado exitosamente!');
    } catch (e) {
      console.error('Error al capturar reportes:', e);
    } finally {
      win.close();
      server.close();
      app.quit();
      process.exit(0);
    }
  });
});
