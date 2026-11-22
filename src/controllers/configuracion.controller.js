const fs = require('fs');
const path = require('path');
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/configuracion/horarios
 * Obtiene la configuración de horarios para cada día de la semana (HU-003).
 */
const getHorarios = catchAsync(async (req, res, next) => {
  const sql = 'SELECT day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin FROM working_hours ORDER BY day_of_week ASC';
  const rows = await new Promise((resolve, reject) => {
    db.all(sql, [], (err, r) => (err ? reject(err) : resolve(r)));
  });

  res.status(200).json({
    success: true,
    horarios: rows
  });
});

/**
 * PUT /api/configuracion/horarios
 * Actualiza la configuración de horarios para los días de la semana y la sincroniza con la tabla settings.
 */
const updateHorarios = catchAsync(async (req, res, next) => {
  const { horarios } = req.body;

  if (!horarios || !Array.isArray(horarios) || horarios.length !== 7) {
    throw new AppError('Debe proporcionar la configuración para los 7 días de la semana.', 400);
  }

  // 1. Guardar la configuración en la tabla working_hours (transacción SQLite)
  await new Promise((resolve, reject) => {
    db.serialize(async () => {
      db.run('BEGIN TRANSACTION', (err) => {
        if (err) return reject(err);
      });

      const stmt = db.prepare(`
        UPDATE working_hours 
        SET activo = ?, mañana_inicio = ?, mañana_fin = ?, tarde_inicio = ?, tarde_fin = ?
        WHERE day_of_week = ?
      `);

      let updateError = null;
      for (const h of horarios) {
        const activo = h.activo ? 1 : 0;
        const m_start = h.mañana_inicio || null;
        const m_end = h.mañana_fin || null;
        const t_start = h.tarde_inicio || null;
        const t_end = h.tarde_fin || null;

        await new Promise((res) => {
          stmt.run([activo, m_start, m_end, t_start, t_end, h.day_of_week], (err) => {
            if (err) updateError = err;
            res();
          });
        });
      }

      stmt.finalize((err) => {
        if (err || updateError) {
          db.run('ROLLBACK');
          return reject(err || updateError);
        }

        db.run('COMMIT', (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    });
  });

  // 2. Sincronizar dinámicamente con settings.clinic_hours para no romper la agenda semanal actual
  const activeDays = [];
  const timeWindowsMap = new Map();

  horarios.forEach(h => {
    if (h.activo) {
      activeDays.push(h.day_of_week);
      
      if (h.mañana_inicio && h.mañana_fin) {
        const key = `${h.mañana_inicio}-${h.mañana_fin}`;
        timeWindowsMap.set(key, { start: h.mañana_inicio, end: h.mañana_fin });
      }
      if (h.tarde_inicio && h.tarde_fin) {
        const key = `${h.tarde_inicio}-${h.tarde_fin}`;
        timeWindowsMap.set(key, { start: h.tarde_inicio, end: h.tarde_fin });
      }
    }
  });

  const updatedSettings = {
    workDays: activeDays,
    timeWindows: Array.from(timeWindowsMap.values())
  };

  await new Promise((resolve, reject) => {
    db.run(
      "UPDATE settings SET value = ? WHERE key = 'clinic_hours'",
      [JSON.stringify(updatedSettings)],
      (err) => {
        if (err) reject(err);
        else resolve();
      }
    );
  });

  res.status(200).json({
    success: true,
    message: 'Horario de atención actualizado con éxito.'
  });
});

const getExceptions = catchAsync(async (req, res, next) => {
  const sql = 'SELECT id, exception_date, description, is_recurring FROM clinic_exceptions ORDER BY exception_date ASC';
  const rows = await new Promise((resolve, reject) => {
    db.all(sql, [], (err, r) => (err ? reject(err) : resolve(r)));
  });

  res.status(200).json({
    success: true,
    exceptions: rows
  });
});

const createException = catchAsync(async (req, res, next) => {
  const { exception_date, description, is_recurring } = req.body;
  const isRecurringVal = is_recurring ? 1 : 0;

  if (!exception_date || !description || !description.trim()) {
    throw new AppError('La fecha y la descripción son obligatorias.', 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception_date)) {
    throw new AppError('Formato de fecha inválido. Use YYYY-MM-DD.', 400);
  }

  // 1. Validar que la fecha del feriado no sea en el pasado
  const localDate = new Date();
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  const todayLocalStr = `${yyyy}-${mm}-${dd}`;

  if (exception_date < todayLocalStr) {
    throw new AppError('No se pueden registrar feriados en fechas pasadas.', 400);
  }

  // 2. Validar que no existan citas agendadas activas en esa fecha
  const countSql = "SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ? AND status != 'Cancelada'";
  const activeApptsCount = await new Promise((resolve, reject) => {
    db.get(countSql, [exception_date], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });

  if (activeApptsCount > 0) {
    throw new AppError(`No es posible establecer un cierre. Existen ${activeApptsCount} cita(s) activas agendadas en esta fecha. Reprograme o cancele las citas primero.`, 400);
  }

  const sql = 'INSERT INTO clinic_exceptions (exception_date, description, is_recurring) VALUES (?, ?, ?)';
  const newId = await new Promise((resolve, reject) => {
    db.run(sql, [exception_date, description.trim(), isRecurringVal], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          reject(new AppError('Ya existe una excepción registrada para esta fecha.', 400));
        } else {
          reject(err);
        }
      } else {
        resolve(this.lastID);
      }
    });
  });

  res.status(201).json({
    success: true,
    message: 'Excepción de horario registrada con éxito.',
    exception: {
      id: newId,
      exception_date,
      description,
      is_recurring: isRecurringVal
    }
  });
});

const deleteException = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const result = await new Promise((resolve, reject) => {
    db.run('DELETE FROM clinic_exceptions WHERE id = ?', [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });

  if (result === 0) {
    throw new AppError('La excepción especificada no existe.', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Excepción de horario eliminada con éxito.'
  });
});

const updateException = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { exception_date, description, is_recurring } = req.body;
  const isRecurringVal = is_recurring ? 1 : 0;

  if (!exception_date || !description || !description.trim()) {
    throw new AppError('La fecha y la descripción son obligatorias.', 400);
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(exception_date)) {
    throw new AppError('Formato de fecha inválido. Use YYYY-MM-DD.', 400);
  }

  // 1. Validar que la nueva fecha no sea en el pasado
  const localDate = new Date();
  const yyyy = localDate.getFullYear();
  const mm = String(localDate.getMonth() + 1).padStart(2, '0');
  const dd = String(localDate.getDate()).padStart(2, '0');
  const todayLocalStr = `${yyyy}-${mm}-${dd}`;

  if (exception_date < todayLocalStr) {
    throw new AppError('No se pueden registrar feriados en fechas pasadas.', 400);
  }

  // 2. Verificar si existen citas agendadas activas en esa fecha
  const countSql = "SELECT COUNT(*) AS count FROM appointments WHERE appointment_date = ? AND status != 'Cancelada'";
  const activeApptsCount = await new Promise((resolve, reject) => {
    db.get(countSql, [exception_date], (err, row) => {
      if (err) reject(err);
      else resolve(row ? row.count : 0);
    });
  });

  if (activeApptsCount > 0) {
    throw new AppError(`No es posible establecer un cierre. Existen ${activeApptsCount} cita(s) activas agendadas en esta fecha. Reprograme o cancele las citas primero.`, 400);
  }

  // 3. Ejecutar la actualización
  const sql = 'UPDATE clinic_exceptions SET exception_date = ?, description = ?, is_recurring = ? WHERE id = ?';
  const changes = await new Promise((resolve, reject) => {
    db.run(sql, [exception_date, description.trim(), isRecurringVal, id], function(err) {
      if (err) {
        if (err.message.includes('UNIQUE')) {
          reject(new AppError('Ya existe una excepción registrada para esta fecha.', 400));
        } else {
          reject(err);
        }
      } else {
        resolve(this.changes);
      }
    });
  });

  if (changes === 0) {
    throw new AppError('La excepción especificada no existe.', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Excepción de horario modificada con éxito.',
    exception: {
      id: parseInt(id),
      exception_date,
      description,
      is_recurring: isRecurringVal
    }
  });
});

/**
 * GET /api/configuracion/backup/info
 * Obtiene información de la base de datos (tamaño, registros, última modificación).
 */
const getBackupInfo = catchAsync(async (req, res, next) => {
  const targetDbPath = path.resolve(process.env.DB_PATH || './database.db');
  
  let sizeBytes = 0;
  let lastModified = new Date();
  
  if (fs.existsSync(targetDbPath)) {
    const stats = fs.statSync(targetDbPath);
    sizeBytes = stats.size;
    lastModified = stats.mtime;
  }
  
  const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

  const patientCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM patients', [], (err, row) => resolve(row ? row.count : 0));
  });

  const appointmentCount = await new Promise((resolve) => {
    db.get('SELECT COUNT(*) as count FROM appointments', [], (err, row) => resolve(row ? row.count : 0));
  });

  res.status(200).json({
    success: true,
    info: {
      dbPath: targetDbPath,
      sizeBytes,
      sizeMB: `${sizeMB} MB`,
      lastModified: lastModified.toISOString(),
      patientCount,
      appointmentCount
    }
  });
});

/**
 * GET /api/configuracion/backup/download
 * Descarga el archivo ejecutable de la base de datos database.db
 */
const downloadBackup = catchAsync(async (req, res, next) => {
  const targetDbPath = path.resolve(process.env.DB_PATH || './database.db');

  if (!fs.existsSync(targetDbPath)) {
    throw new AppError('El archivo de base de datos no fue encontrado.', 404);
  }

  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10);
  const timeStr = now.toTimeString().slice(0, 5).replace(':', '');
  const fileName = `Backup_Agenda_Odontologica_${dateStr}_${timeStr}.db`;

  res.download(targetDbPath, fileName, (err) => {
    if (err && !res.headersSent) {
      next(new AppError('Error al descargar la copia de seguridad.', 500));
    }
  });
});

/**
 * POST /api/configuracion/backup/restore
 * Restaura la base de datos a partir de un archivo .db codificado en Base64
 */
const restoreBackup = catchAsync(async (req, res, next) => {
  const { fileData } = req.body;

  if (!fileData) {
    throw new AppError('Debe proporcionar un archivo de respaldo válido.', 400);
  }

  const base64Content = fileData.includes(',') ? fileData.split(',')[1] : fileData;
  const buffer = Buffer.from(base64Content, 'base64');

  // Validar formato SQLite 3
  const magicHeader = buffer.toString('utf8', 0, 15);
  if (magicHeader !== 'SQLite format 3') {
    throw new AppError('El archivo subido no corresponde a una base de datos SQLite válida.', 400);
  }

  const targetDbPath = path.resolve(process.env.DB_PATH || './database.db');
  const backupTempPath = `${targetDbPath}.bak_${Date.now()}`;

  if (fs.existsSync(targetDbPath)) {
    fs.copyFileSync(targetDbPath, backupTempPath);
  }

  try {
    fs.writeFileSync(targetDbPath, buffer);

    // Reconstruir archivos adjuntos/radiografías físicamente en disco a partir del backup restaurado
    const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../../public/uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    db.all("SELECT file_path, file_data FROM patient_attachments WHERE file_data IS NOT NULL", [], (err, rows) => {
      if (!err && rows && rows.length > 0) {
        for (const row of rows) {
          if (row.file_path && row.file_data) {
            try {
              const localFileName = path.basename(row.file_path);
              const localFilePath = path.join(uploadDir, localFileName);
              const matches = row.file_data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
              if (matches && matches[2]) {
                fs.writeFileSync(localFilePath, Buffer.from(matches[2], 'base64'));
              }
            } catch (recreateErr) {
              console.error('Error al restaurar archivo físico adjunto:', recreateErr);
            }
          }
        }
      }
    });

    res.status(200).json({
      success: true,
      message: 'Copia de seguridad restaurada correctamente.'
    });
  } catch (err) {
    if (fs.existsSync(backupTempPath)) {
      fs.copyFileSync(backupTempPath, targetDbPath);
    }
    throw new AppError('Error al sobrescribir la base de datos durante la restauración.', 500);
  }
});

module.exports = {
  getHorarios,
  updateHorarios,
  getExceptions,
  createException,
  updateException,
  deleteException,
  getBackupInfo,
  downloadBackup,
  restoreBackup
};
