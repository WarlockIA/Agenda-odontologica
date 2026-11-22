const db = require('../db');
const { sanitizarCI } = require('../utils/sanitizer');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * GET /api/pacientes/buscar
 * Realiza una búsqueda parcial e insensible a mayúsculas y minúsculas (case-insensitive)
 * en la tabla de pacientes por los campos nombre_completo y ci (HU-009).
 */
const buscarPacientes = catchAsync(async (req, res, next) => {
  const { q } = req.query;

  // Búsqueda preventiva: si el query es menor a 3 caracteres, retornar lista vacía
  if (!q || q.trim().length < 3) {
    return res.status(200).json({
      success: true,
      patients: []
    });
  }

  const queryTerm = `%${q.trim()}%`;
  const sql = `
    SELECT id, nombre_completo, ci, telefono 
    FROM patients 
    WHERE nombre_completo LIKE ? OR ci LIKE ? 
    LIMIT 5
  `;

  const rows = await new Promise((resolve, reject) => {
    db.all(sql, [queryTerm, queryTerm], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  res.status(200).json({
    success: true,
    patients: rows
  });
});

/**
 * POST /api/pacientes
 * Registra un nuevo paciente en la base de datos con verificación preventiva de CI duplicado (HU-008).
 */
const registrarPaciente = catchAsync(async (req, res, next) => {
  const { nombre_completo, telefono, ci, notas_medicas } = req.body;

  // 1. Validaciones básicas en el backend
  if (!nombre_completo || !nombre_completo.trim()) {
    throw new AppError('El nombre completo es obligatorio.', 400);
  }
  if (!ci || !ci.trim()) {
    throw new AppError('La Cédula de Identidad (CI) es obligatoria.', 400);
  }

  // Saneamiento del CI mediante la función de utilidad (Regla de Negocio y Seguridad)
  const ciSanitizado = sanitizarCI(ci);
  if (!ciSanitizado) {
    throw new AppError('La Cédula de Identidad (CI) no es válida.', 400);
  }

  // 2. Consulta preventiva para validar duplicación de CI con valor sanitizado (Escenario 1)
  const checkSql = 'SELECT id FROM patients WHERE ci = ?';
  const existingPatient = await new Promise((resolve, reject) => {
    db.get(checkSql, [ciSanitizado], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  if (existingPatient) {
    throw new AppError('El paciente con este CI ya se encuentra registrado', 400);
  }

  // 3. No hay duplicación, proceder a insertar de forma segura usando el CI limpio
  const insertSql = `
    INSERT INTO patients (nombre_completo, telefono, ci, notas_medicas)
    VALUES (?, ?, ?, ?)
  `;

  const lastID = await new Promise((resolve, reject) => {
    db.run(
      insertSql,
      [
        nombre_completo.trim(),
        telefono ? telefono.trim() : null,
        ciSanitizado,
        notas_medicas ? notas_medicas.trim() : null
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

  res.status(201).json({
    success: true,
    message: 'Paciente registrado con éxito.',
    patient: {
      id: lastID,
      nombre_completo: nombre_completo.trim(),
      telefono: telefono ? telefono.trim() : null,
      ci: ciSanitizado,
      notas_medicas: notas_medicas ? notas_medicas.trim() : null
    }
  });
});

/**
 * GET /api/pacientes
 * Retorna la lista de todos los pacientes registrados.
 */
const listarPacientes = catchAsync(async (req, res, next) => {
  const sql = 'SELECT * FROM patients ORDER BY creado_en DESC';
  const rows = await new Promise((resolve, reject) => {
    db.all(sql, [], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  res.status(200).json({
    success: true,
    patients: rows
  });
});

/**
 * GET /api/pacientes/:id/historial-cronologico
 * Retorna todo el expediente clínico del paciente ordenado por fecha DESC, hora DESC.
 */
const obtenerHistorialCronologico = catchAsync(async (req, res, next) => {
  const patientId = req.params.id;

  // 1. Validar la existencia del paciente
  const checkPatientSql = 'SELECT * FROM patients WHERE id = ?';
  const patient = await new Promise((resolve, reject) => {
    db.get(checkPatientSql, [patientId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('Paciente no encontrado.', 404);
  }

  // 2. Consulta optimizada para Citas y sus tratamientos asociados
  const appointmentsSql = `
    SELECT 
      a.id AS appointment_id,
      a.appointment_date AS fecha,
      a.appointment_time AS hora,
      a.status AS estado,
      a.observaciones_clinicas,
      u.name AS odontologo_nombre,
      t.id AS tratamiento_id,
      t.nombre AS tratamiento_nombre,
      at.costo_aplicado
    FROM appointments a
    LEFT JOIN users u ON a.created_by = u.id
    LEFT JOIN appointment_treatments at ON a.id = at.appointment_id
    LEFT JOIN treatments t ON at.treatment_id = t.id
    WHERE a.patient_id = ?
    ORDER BY a.appointment_date DESC, a.appointment_time DESC, t.nombre ASC
  `;

  const appointmentRows = await new Promise((resolve, reject) => {
    db.all(appointmentsSql, [patientId], (err, r) => {
      if (err) reject(err);
      else resolve(r || []);
    });
  });

  // Agrupar tratamientos por cita
  const appointmentsMap = new Map();
  appointmentRows.forEach(row => {
    if (!row.appointment_id) return;
    
    if (!appointmentsMap.has(row.appointment_id)) {
      appointmentsMap.set(row.appointment_id, {
        type: 'appointment',
        id: row.appointment_id,
        fecha: row.fecha,
        hora: row.hora,
        estado: row.estado,
        observaciones_clinicas: row.observaciones_clinicas || '',
        odontologo_nombre: row.odontologo_nombre || 'No asignado',
        tratamientos: []
      });
    }

    if (row.tratamiento_id) {
      appointmentsMap.get(row.appointment_id).tratamientos.push({
        id: row.tratamiento_id,
        nombre: row.tratamiento_nombre,
        costo_aplicado: row.costo_aplicado
      });
    }
  });
  const appointmentsList = Array.from(appointmentsMap.values());

  // 3. Consulta de Evoluciones Financieras
  const evolutionsSql = `
    SELECT id, fecha, diente_nro, rx, trabajo_realizado, debe, haber, saldo, created_at
    FROM evolucion_tratamientos
    WHERE paciente_id = ?
    ORDER BY fecha DESC, id DESC
  `;
  const evolutionRows = await new Promise((resolve, reject) => {
    db.all(evolutionsSql, [patientId], (err, r) => {
      if (err) reject(err);
      else resolve(r || []);
    });
  });

  const evolutionsList = evolutionRows.map(row => {
    let hora = '12:00';
    if (row.created_at) {
      const parts = row.created_at.split(' ');
      if (parts.length > 1) {
        hora = parts[1].substring(0, 5); // HH:MM
      }
    }
    return {
      type: 'financial',
      id: row.id,
      fecha: row.fecha,
      hora: hora,
      diente_nro: row.diente_nro,
      rx: row.rx,
      trabajo_realizado: row.trabajo_realizado,
      debe: row.debe,
      haber: row.haber,
      saldo: row.saldo
    };
  });

  // 4. Consulta de Archivos Adjuntos
  const attachmentsSql = `
    SELECT id, file_name, file_path, mime_type, description, created_at
    FROM patient_attachments
    WHERE paciente_id = ?
    ORDER BY created_at DESC
  `;
  const attachmentRows = await new Promise((resolve, reject) => {
    db.all(attachmentsSql, [patientId], (err, r) => {
      if (err) reject(err);
      else resolve(r || []);
    });
  });

  const attachmentsList = attachmentRows.map(row => {
    let fecha = '2026-07-05';
    let hora = '12:00';
    if (row.created_at) {
      const parts = row.created_at.split(' ');
      if (parts.length > 0) {
        fecha = parts[0]; // YYYY-MM-DD
      }
      if (parts.length > 1) {
        hora = parts[1].substring(0, 5); // HH:MM
      }
    }
    return {
      type: 'attachment',
      id: row.id,
      fecha: fecha,
      hora: hora,
      file_name: row.file_name,
      file_path: row.file_path,
      mime_type: row.mime_type,
      description: row.description
    };
  });

  // 5. Unificar e integrar cronológicamente
  const unifiedHistory = [
    ...appointmentsList,
    ...evolutionsList,
    ...attachmentsList
  ];

  unifiedHistory.sort((a, b) => {
    // Ordenar por fecha descendente
    if (a.fecha !== b.fecha) {
      return b.fecha.localeCompare(a.fecha);
    }
    // Si la fecha es igual, ordenar por hora descendente
    if (a.hora && b.hora) {
      return b.hora.localeCompare(a.hora);
    }
    // Si la hora es igual, ordenar por ID descendente
    return b.id - a.id;
  });

  res.status(200).json({
    success: true,
    patient: {
      id: patient.id,
      nombre_completo: patient.nombre_completo,
      ci: patient.ci,
      telefono: patient.telefono,
      notas_medicas: patient.notas_medicas
    },
    historial: unifiedHistory
  });
});

/**
 * GET /api/pacientes/check-ci
 * Verifica si un número de Cédula de Identidad (CI) ya está registrado en la base de datos (excluyendo opcionalmente un ID de paciente).
 */
const checkCiDuplicated = catchAsync(async (req, res, next) => {
  const { ci, excludeId } = req.query;

  if (!ci || !ci.trim()) {
    return res.status(200).json({ success: true, exists: false });
  }

  // Sanitizar el CI con la misma utilidad de estandarización
  const ciSanitizado = sanitizarCI(ci);
  if (!ciSanitizado) {
    return res.status(200).json({ success: true, exists: false });
  }

  let sql = 'SELECT id FROM patients WHERE ci = ?';
  const params = [ciSanitizado];

  if (excludeId) {
    sql += ' AND id != ?';
    params.push(parseInt(excludeId));
  }

  const existing = await new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  res.status(200).json({
    success: true,
    exists: !!existing
  });
});

/**
 * GET /api/pacientes/next-ficha-nro
 * Sugiere el siguiente número de ficha física disponible en base de datos.
 */
const sugerirSiguienteFichaNro = catchAsync(async (req, res, next) => {
  const sql = 'SELECT MAX(ficha_nro) as max_ficha FROM patients';
  const result = await new Promise((resolve, reject) => {
    db.get(sql, [], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  const nextFicha = result && result.max_ficha ? parseInt(result.max_ficha) + 1 : 1;
  res.status(200).json({
    success: true,
    nextFichaNro: nextFicha
  });
});

module.exports = {
  buscarPacientes,
  registrarPaciente,
  listarPacientes,
  obtenerHistorialCronologico,
  checkCiDuplicated,
  sugerirSiguienteFichaNro
};
