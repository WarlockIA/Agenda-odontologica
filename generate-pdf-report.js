const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const htmlTemplatePath = path.join(__dirname, 'report_template.html');
const screenshotsDir = path.join(__dirname, 'report_assets', 'screenshots');
const outputPdfPath = path.join(__dirname, 'Informe_Proyecto_Taller_II_Agenda_Odontologica.pdf');

function fileToBase64(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const fileBuffer = fs.readFileSync(filePath);
  return fileBuffer.toString('base64');
}

app.whenReady().then(async () => {
  console.log('===================================================');
  console.log(' GENERANDO INFORME DEL PROYECTO EN FORMATO PDF');
  console.log('===================================================');

  let htmlContent = fs.readFileSync(htmlTemplatePath, 'utf8');

  // Convertir capturas de pantalla y logo UAJMS a base64
  const img1 = fileToBase64(path.join(screenshotsDir, '1_login.png'));
  const img2 = fileToBase64(path.join(screenshotsDir, '2_agenda_citas.png'));
  const img3 = fileToBase64(path.join(screenshotsDir, '3_pacientes_ficha.png'));
  const img4 = fileToBase64(path.join(screenshotsDir, '4_tratamientos.png'));
  const img5 = fileToBase64(path.join(screenshotsDir, '5_inventario.png'));
  const img6 = fileToBase64(path.join(screenshotsDir, '6_reportes.png'));
  const img7 = fileToBase64(path.join(screenshotsDir, '7_configuracion.png'));
  const logoUajms = fileToBase64(path.join(__dirname, 'report_assets', 'uajms_logo.png'));

  htmlContent = htmlContent
    .replace('{{IMG_UAJMS_LOGO}}', logoUajms)
    .replace('{{IMG_1_LOGIN}}', img1)
    .replace('{{IMG_2_AGENDA}}', img2)
    .replace('{{IMG_3_PACIENTES}}', img3)
    .replace('{{IMG_4_TRATAMIENTOS}}', img4)
    .replace('{{IMG_5_INVENTARIO}}', img5)
    .replace('{{IMG_6_REPORTES}}', img6)
    .replace('{{IMG_7_CONFIGURACION}}', img7);

  const tempHtmlPath = path.join(__dirname, 'report_compiled_temp.html');
  fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

  const win = new BrowserWindow({
    width: 1200,
    height: 1600,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  try {
    console.log('Cargando documento en motor de impresión de Electron...');
    await win.loadFile(tempHtmlPath);
    await new Promise(resolve => setTimeout(resolve, 3000));

    console.log('Generando PDF con formato A4...');
    const pdfData = await win.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4
      }
    });

    fs.writeFileSync(outputPdfPath, pdfData);
    console.log(`✅ PDF generado exitosamente en:\n   ${outputPdfPath}`);
  } catch (err) {
    console.error('❌ Error al generar el documento PDF:', err);
  } finally {
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
    win.close();
    app.quit();
    process.exit(0);
  }
});
