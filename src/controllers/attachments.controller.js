const fs = require('fs');
const path = require('path');
const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

// Asegurar existencia de la carpeta de subidas
const uploadDir = process.env.UPLOAD_PATH || path.join(__dirname, '../../public/uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

/**
 * GET /api/pacientes/:id/attachments
 * Obtiene la lista de todos los archivos adjuntos de un paciente.
 */
const listAttachments = catchAsync(async (req, res, next) => {
  const { id: paciente_id } = req.params;

  // Verificar que el paciente exista
  const patient = await new Promise((resolve, reject) => {
    db.get("SELECT id FROM patients WHERE id = ?", [paciente_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('El paciente especificado no existe.', 404);
  }

  const attachments = await new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM patient_attachments WHERE paciente_id = ? ORDER BY created_at DESC",
      [paciente_id],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      }
    );
  });

  // Reconstruir archivos físicos en disco si fueron borrados o provienen de una restauración de backup
  for (const att of attachments) {
    if (att.file_path && att.file_data) {
      const localFileName = path.basename(att.file_path);
      const localFilePath = path.join(uploadDir, localFileName);
      if (!fs.existsSync(localFilePath)) {
        try {
          const matches = att.file_data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches[2]) {
            fs.writeFileSync(localFilePath, Buffer.from(matches[2], 'base64'));
          }
        } catch (fsErr) {
          console.error('Error al recrear imagen desde Base64:', fsErr);
        }
      }
    }
  }

  res.status(200).json({
    success: true,
    attachments
  });
});

/**
 * POST /api/pacientes/:id/attachments
 * Sube y decodifica un archivo Base64 y lo registra para el paciente.
 */
const uploadAttachment = catchAsync(async (req, res, next) => {
  const { id: paciente_id } = req.params;
  const { filename, fileData, description } = req.body;

  if (!filename || !fileData) {
    throw new AppError('El nombre de archivo y los datos del archivo son obligatorios.', 400);
  }

  // Verificar que el paciente exista
  const patient = await new Promise((resolve, reject) => {
    db.get("SELECT id FROM patients WHERE id = ?", [paciente_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('El paciente especificado no existe.', 404);
  }

  // Analizar el Data URI de Base64
  const matches = fileData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new AppError('Formato de archivo inválido. Debe ser un Data URI en Base64.', 400);
  }

  const mimeType = matches[1];
  const base64Content = matches[2];
  const buffer = Buffer.from(base64Content, 'base64');

  // Limitar tipos de archivos permitidos
  const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf'];
  if (!allowedMimeTypes.includes(mimeType) && !mimeType.startsWith('image/')) {
    throw new AppError('Tipo de archivo no permitido. Solo se aceptan imágenes y PDFs.', 400);
  }

  // Limitar tamaño de archivo a 10MB
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (buffer.length > maxSize) {
    throw new AppError('El archivo excede el tamaño máximo permitido de 10MB.', 400);
  }

  // Generar nombre de archivo único
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
  const savedFilename = `${Date.now()}_${sanitizedFilename}`;
  const savedFilePath = path.join(uploadDir, savedFilename);

  // Guardar el archivo físicamente en el disco
  fs.writeFileSync(savedFilePath, buffer);

  // Ruta web de acceso estático
  const webPath = `/uploads/${savedFilename}`;

  // Insertar metadatos e imagen base64 completa en la base de datos para respaldo integral
  const sqlInsert = `
    INSERT INTO patient_attachments (paciente_id, file_name, file_path, mime_type, file_data, description)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  const newId = await new Promise((resolve, reject) => {
    db.run(sqlInsert, [
      paciente_id,
      filename,
      webPath,
      mimeType,
      fileData,
      description || null
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });

  const newRow = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM patient_attachments WHERE id = ?", [newId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  res.status(201).json({
    success: true,
    message: 'Archivo adjunto guardado con éxito.',
    attachment: newRow
  });
});

/**
 * DELETE /api/pacientes/attachments/:id
 * Elimina un adjunto de la base de datos y su archivo físico del disco.
 */
const deleteAttachment = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  // Obtener info del adjunto para saber la ruta física del archivo
  const attachment = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM patient_attachments WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!attachment) {
    throw new AppError('El archivo adjunto especificado no existe.', 404);
  }

  // Eliminar el registro en la base de datos
  await new Promise((resolve, reject) => {
    db.run("DELETE FROM patient_attachments WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  // Eliminar el archivo físico de la carpeta uploads
  const localFileName = path.basename(attachment.file_path);
  const localFilePath = path.join(uploadDir, localFileName);

  if (fs.existsSync(localFilePath)) {
    try {
      fs.unlinkSync(localFilePath);
    } catch (fsErr) {
      console.error('Error al borrar el archivo físico del disco:', fsErr);
    }
  }

  res.status(200).json({
    success: true,
    message: 'Archivo adjunto eliminado con éxito.'
  });
});

module.exports = {
  listAttachments,
  uploadAttachment,
  deleteAttachment
};
