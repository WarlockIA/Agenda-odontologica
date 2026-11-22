const fs = require('fs');
const path = require('path');

/**
 * Rutina de Respaldo Automatizado de Base de Datos y Archivos Adjuntos
 * Proyecto: Agenda Odontológica - Consultorio Odontológico Cristo Rey
 */

function createBackup() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFolder = path.join(__dirname, 'backups', `backup_${timestamp}`);
  
  if (!fs.existsSync(backupFolder)) {
    fs.mkdirSync(backupFolder, { recursive: true });
  }

  const dbSource = path.join(__dirname, 'database.db');
  const dbDest = path.join(backupFolder, 'database.db');

  if (fs.existsSync(dbSource)) {
    fs.copyFileSync(dbSource, dbDest);
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Respaldo de base de datos generado en: ${dbDest}`);
  } else {
    console.error(`❌ No se encontró la base de datos fuente en: ${dbSource}`);
  }

  // Opcional: respaldar carpeta de uploads
  const uploadsSource = path.join(__dirname, 'public', 'uploads');
  const uploadsDest = path.join(backupFolder, 'uploads');
  if (fs.existsSync(uploadsSource)) {
    fs.cpSync(uploadsSource, uploadsDest, { recursive: true });
    console.log(`[${new Date().toLocaleTimeString()}] ✅ Respaldo de adjuntos/radiografías generado en: ${uploadsDest}`);
  }

  return backupFolder;
}

if (require.main === module) {
  console.log('--- INICIANDO RUTINA DE BACKUP AUTOMATIZADO ---');
  createBackup();
  console.log('--- BACKUP FINALIZADO CON ÉXITO ---');
}

module.exports = { createBackup };
