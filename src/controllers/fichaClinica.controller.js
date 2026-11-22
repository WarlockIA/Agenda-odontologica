const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

/**
 * Recalcula en cascada y de forma secuencial todos los saldos históricos
 * de un paciente en particular, asegurando que Saldo = Saldo_Anterior + Debe - Haber.
 * Retorna el saldo final acumulado del paciente.
 * 
 * @param {number|string} pacienteId 
 * @returns {Promise<number>}
 */
function recalculateSaldos(pacienteId) {
  return new Promise((resolve, reject) => {
    const sqlSelect = "SELECT id, debe, haber FROM evolucion_tratamientos WHERE paciente_id = ? ORDER BY fecha ASC, id ASC";
    db.all(sqlSelect, [pacienteId], async (err, rows) => {
      if (err) return reject(err);
      
      if (rows.length === 0) {
        return resolve(0.00);
      }

      try {
        let runningSaldo = 0.00;
        for (const row of rows) {
          runningSaldo = (runningSaldo + row.debe) - row.haber;
          // Redondear a 2 decimales para evitar errores de precisión de punto flotante en JS
          runningSaldo = Math.round((runningSaldo + Number.EPSILON) * 100) / 100;
          
          await new Promise((res, rej) => {
            db.run(
              "UPDATE evolucion_tratamientos SET saldo = ? WHERE id = ?",
              [runningSaldo, row.id],
              (err2) => {
                if (err2) rej(err2);
                else res();
              }
            );
          });
        }
        resolve(runningSaldo);
      } catch (errUpdate) {
        reject(errUpdate);
      }
    });
  });
}

/**
 * GET /api/pacientes/:id/ficha-clinica
 * Obtiene la ficha clínica del paciente y su historial de tratamientos con saldo.
 */
const getFichaClinica = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const patient = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM patients WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('El paciente especificado no existe.', 404);
  }

  const evolution = await new Promise((resolve, reject) => {
    db.all(
      "SELECT * FROM evolucion_tratamientos WHERE paciente_id = ? ORDER BY fecha ASC, id ASC",
      [id],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      }
    );
  });

  const saldoTotal = evolution.length > 0 ? evolution[evolution.length - 1].saldo : 0.00;

  res.status(200).json({
    success: true,
    patient,
    evolution,
    saldoTotal
  });
});

/**
 * PUT /api/pacientes/:id/ficha-clinica
 * Actualiza los datos clínicos y demográficos de la ficha del paciente.
 */
const updateFichaClinica = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const {
    profesion_ocupacion,
    fecha_nacimiento,
    edad,
    domicilio,
    sexo,
    ciudad_localidad,
    examen_extraoral,
    diagnostico_presuntivo,
    ficha_nro,
    odontograma
  } = req.body;

  const patient = await new Promise((resolve, reject) => {
    db.get("SELECT id FROM patients WHERE id = ?", [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('El paciente especificado no existe.', 404);
  }

  if (ficha_nro) {
    const isUnique = await new Promise((resolve, reject) => {
      db.get("SELECT id FROM patients WHERE ficha_nro = ? AND id != ?", [ficha_nro, id], (err, row) => {
        if (err) reject(err);
        else resolve(!row);
      });
    });
    if (!isUnique) {
      throw new AppError('El número de ficha ya está asignado a otro paciente.', 400);
    }
  }

  const sqlUpdate = `
    UPDATE patients 
    SET profesion_ocupacion = ?, 
        fecha_nacimiento = ?, 
        edad = ?, 
        domicilio = ?, 
        sexo = ?, 
        ciudad_localidad = ?, 
        examen_extraoral = ?, 
        diagnostico_presuntivo = ?,
        ficha_nro = ?,
        odontograma = ?
    WHERE id = ?
  `;

  await new Promise((resolve, reject) => {
    db.run(sqlUpdate, [
      profesion_ocupacion || null,
      fecha_nacimiento || null,
      edad || null,
      domicilio || null,
      sexo || null,
      ciudad_localidad || null,
      examen_extraoral || null,
      diagnostico_presuntivo || null,
      ficha_nro || null,
      odontograma || null,
      id
    ], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  res.status(200).json({
    success: true,
    message: 'Ficha clínica del paciente actualizada con éxito.'
  });
});

/**
 * POST /api/pacientes/:id/evolucion
 * Registra un renglón de evolución clínica y pago del tratamiento.
 */
const addEvolucionTratamiento = catchAsync(async (req, res, next) => {
  const { id: paciente_id } = req.params;
  const { fecha, diente_nro, rx, trabajo_realizado, debe, haber } = req.body;

  if (!trabajo_realizado) {
    throw new AppError('El trabajo realizado es obligatorio.', 400);
  }

  const patient = await new Promise((resolve, reject) => {
    db.get("SELECT id FROM patients WHERE id = ?", [paciente_id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (!patient) {
    throw new AppError('El paciente especificado no existe.', 404);
  }

  const debeNum = parseFloat(debe) || 0.00;
  const haberNum = parseFloat(haber) || 0.00;

  const sqlInsert = `
    INSERT INTO evolucion_tratamientos (paciente_id, fecha, diente_nro, rx, trabajo_realizado, debe, haber, saldo)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0.00)
  `;

  const newId = await new Promise((resolve, reject) => {
    db.run(sqlInsert, [
      paciente_id,
      fecha || new Date().toISOString().split('T')[0],
      diente_nro || null,
      rx || null,
      trabajo_realizado,
      debeNum,
      haberNum
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
  
  const { treatment_id } = req.body;
  if (treatment_id) {
    // Buscar materiales requeridos
    const materials = await new Promise((resolve) => {
      db.all("SELECT * FROM treatment_materials WHERE treatment_id = ?", [treatment_id], (err, rows) => resolve(rows || []));
    });
    
    // Descuento FEFO automático
    for (const mat of materials) {
      let qty = mat.cantidad_requerida;
      const batches = await new Promise((resolve) => {
        db.all("SELECT * FROM inventory_batches WHERE item_id = ? AND cantidad_disponible > 0 ORDER BY fecha_caducidad ASC, id ASC", [mat.item_id], (err, rows) => resolve(rows || []));
      });
      
      let deducted = 0;
      for (const batch of batches) {
        if (qty <= 0) break;
        const deductAmount = Math.min(batch.cantidad_disponible, qty);
        
        await new Promise((resolve) => {
          db.run("UPDATE inventory_batches SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?", [deductAmount, batch.id], () => resolve());
        });
        await new Promise((resolve) => {
          db.run("INSERT INTO inventory_transactions (batch_id, tipo, cantidad, motivo) VALUES (?, 'SALIDA', ?, ?)", 
                 [batch.id, deductAmount, 'Uso automático en tratamiento ' + newId], () => resolve());
        });
        await new Promise((resolve) => {
          db.run("INSERT INTO appointment_consumables (evolucion_id, item_id, cantidad_usada) VALUES (?, ?, ?)", 
                 [newId, mat.item_id, deductAmount], () => resolve());
        });
        
        qty -= deductAmount;
        deducted += deductAmount;
      }
    }
  }

  const saldoFinal = await recalculateSaldos(paciente_id);

  const newRow = await new Promise((resolve, reject) => {
    db.get("SELECT * FROM evolucion_tratamientos WHERE id = ?", [newId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  res.status(201).json({
    success: true,
    message: 'Tratamiento registrado con éxito.',
    evolutionRow: newRow,
    saldoTotal: saldoFinal
  });
});

/**
 * DELETE /api/pacientes/evolucion/:id
 * Elimina una fila del control de evolución y recalcula los saldos de forma consistente.
 */
const deleteEvolucionTratamiento = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const row = await new Promise((resolve, reject) => {
    db.get("SELECT paciente_id FROM evolucion_tratamientos WHERE id = ?", [id], (err, r) => {
      if (err) reject(err);
      else resolve(r);
    });
  });

  if (!row) {
    throw new AppError('El registro de evolución especificado no existe.', 404);
  }

  const paciente_id = row.paciente_id;

  await new Promise((resolve, reject) => {
    db.run("DELETE FROM evolucion_tratamientos WHERE id = ?", [id], (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const saldoFinal = await recalculateSaldos(paciente_id);

  res.status(200).json({
    success: true,
    message: 'Registro de evolución eliminado con éxito.',
    saldoTotal: saldoFinal
  });
});

module.exports = {
  getFichaClinica,
  updateFichaClinica,
  addEvolucionTratamiento,
  deleteEvolucionTratamiento
};
