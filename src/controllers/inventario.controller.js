const db = require('../db');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');

exports.getItems = catchAsync(async (req, res, next) => {
  const items = await new Promise((resolve, reject) => {
    // We get items and their total available stock by summing batches
    db.all(`
      SELECT i.*, 
             COALESCE(SUM(b.cantidad_disponible), 0) as stock_total,
             COALESCE(SUM(CASE WHEN b.fecha_caducidad <= date('now', '+30 days') AND b.cantidad_disponible > 0 THEN 1 ELSE 0 END), 0) as lotes_por_vencer,
             MIN(CASE WHEN b.cantidad_disponible > 0 AND b.fecha_caducidad IS NOT NULL THEN b.fecha_caducidad END) as prox_fecha_caducidad,
             MIN(CASE WHEN b.cantidad_disponible > 0 AND b.fecha_caducidad IS NOT NULL THEN CAST(julianday(b.fecha_caducidad) - julianday('now', 'start of day') AS INTEGER) END) as dias_para_vencer
      FROM inventory_items i
      LEFT JOIN inventory_batches b ON i.id = b.item_id AND b.cantidad_disponible > 0
      GROUP BY i.id
      ORDER BY i.nombre ASC
    `, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
  res.status(200).json({ success: true, data: items });
});

exports.createItem = catchAsync(async (req, res, next) => {
  const { nombre, categoria, unidad_medida, stock_minimo } = req.body;
  if (!nombre) throw new AppError('El nombre del insumo es requerido', 400);

  const newId = await new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO inventory_items (nombre, categoria, unidad_medida, stock_minimo) VALUES (?, ?, ?, ?)",
      [nombre, categoria, unidad_medida, stock_minimo || 0],
      function(err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
  res.status(201).json({ success: true, id: newId });
});

exports.updateItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { nombre, categoria, unidad_medida, stock_minimo } = req.body;
  
  await new Promise((resolve, reject) => {
    db.run(
      "UPDATE inventory_items SET nombre = ?, categoria = ?, unidad_medida = ?, stock_minimo = ? WHERE id = ?",
      [nombre, categoria, unidad_medida, stock_minimo, id],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
  res.status(200).json({ success: true });
});

exports.deleteItem = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await new Promise((resolve, reject) => {
    db.run("DELETE FROM inventory_items WHERE id = ?", [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
  res.status(200).json({ success: true });
});

exports.getSuppliers = catchAsync(async (req, res, next) => {
  const suppliers = await new Promise((resolve, reject) => {
    db.all(`
      SELECT s.*, 
             COUNT(b.id) as total_lotes
      FROM inventory_suppliers s
      LEFT JOIN inventory_batches b ON s.id = b.supplier_id
      GROUP BY s.id
      ORDER BY s.nombre_empresa ASC
    `, [], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
  res.status(200).json({ success: true, data: suppliers });
});

exports.createSupplier = catchAsync(async (req, res, next) => {
  const { nombre_empresa, contacto, telefono, email } = req.body;
  if (!nombre_empresa) throw new AppError('El nombre de la empresa es requerido', 400);

  const newId = await new Promise((resolve, reject) => {
    db.run(
      "INSERT INTO inventory_suppliers (nombre_empresa, contacto, telefono, email) VALUES (?, ?, ?, ?)",
      [nombre_empresa, contacto || null, telefono || null, email || null],
      function(err) {
        if (err) reject(err); else resolve(this.lastID);
      }
    );
  });
  res.status(201).json({ success: true, id: newId });
});

exports.updateSupplier = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { nombre_empresa, contacto, telefono, email } = req.body;
  if (!nombre_empresa) throw new AppError('El nombre de la empresa es requerido', 400);

  await new Promise((resolve, reject) => {
    db.run(
      "UPDATE inventory_suppliers SET nombre_empresa = ?, contacto = ?, telefono = ?, email = ? WHERE id = ?",
      [nombre_empresa, contacto || null, telefono || null, email || null, id],
      (err) => { if (err) reject(err); else resolve(); }
    );
  });
  res.status(200).json({ success: true });
});

exports.deleteSupplier = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  await new Promise((resolve, reject) => {
    db.run("DELETE FROM inventory_suppliers WHERE id = ?", [id], (err) => {
      if (err) reject(err); else resolve();
    });
  });
  res.status(200).json({ success: true });
});

exports.getBatches = catchAsync(async (req, res, next) => {
  const { itemId } = req.params;
  const batches = await new Promise((resolve, reject) => {
    db.all("SELECT * FROM inventory_batches WHERE item_id = ? AND cantidad_disponible > 0 ORDER BY fecha_caducidad ASC", [itemId], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
  res.status(200).json({ success: true, data: batches });
});

exports.getDashboardMetrics = catchAsync(async (req, res, next) => {
  const metrics = await new Promise((resolve, reject) => {
    db.all(`
      SELECT 
        (SELECT COUNT(*) FROM inventory_items) as total_items,
        (SELECT COUNT(*) FROM (
           SELECT i.id FROM inventory_items i 
           LEFT JOIN inventory_batches b ON i.id = b.item_id AND b.cantidad_disponible > 0
           GROUP BY i.id 
           HAVING COALESCE(SUM(b.cantidad_disponible), 0) <= i.stock_minimo
        )) as items_low_stock,
        (SELECT COUNT(*) FROM inventory_batches WHERE fecha_caducidad <= date('now', '+30 days') AND cantidad_disponible > 0) as expiring_soon
    `, [], (err, rows) => {
      if (err) reject(err); else resolve(rows[0]);
    });
  });
  res.status(200).json({ success: true, data: metrics });
});

exports.registerTransaction = catchAsync(async (req, res, next) => {
  const { item_id, tipo, cantidad, motivo, supplier_id, numero_lote, fecha_caducidad, costo_unitario } = req.body;
  
  if (!item_id || !tipo || !cantidad) {
    throw new AppError('Faltan datos requeridos', 400);
  }

  const qty = parseInt(cantidad, 10);
  if (qty <= 0) throw new AppError('Cantidad debe ser mayor a 0', 400);

  if (tipo === 'ENTRADA') {
    // Create new batch
    const batchId = await new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [item_id, supplier_id || null, numero_lote || null, fecha_caducidad || null, costo_unitario || 0, qty, qty], function(err) {
        if (err) reject(err); else resolve(this.lastID);
      });
    });

    await new Promise((resolve, reject) => {
      db.run("INSERT INTO inventory_transactions (batch_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)",
        [batchId, 'ENTRADA', qty, motivo || 'Compra de insumo'], (err) => {
          if (err) reject(err); else resolve();
        });
    });
    
    return res.status(200).json({ success: true, message: 'Entrada registrada' });
  } 
  
  if (tipo === 'SALIDA' || tipo === 'AJUSTE') {
    // FEFO Logic
    const batches = await new Promise((resolve, reject) => {
      db.all("SELECT * FROM inventory_batches WHERE item_id = ? AND cantidad_disponible > 0 ORDER BY fecha_caducidad ASC, id ASC", [item_id], (err, rows) => {
        if (err) reject(err); else resolve(rows);
      });
    });

    const totalAvailable = batches.reduce((acc, b) => acc + b.cantidad_disponible, 0);
    if (totalAvailable < qty) {
      throw new AppError('No hay suficiente stock para realizar esta operación', 400);
    }

    await new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('BEGIN TRANSACTION', (err) => {
          if (err) return reject(err);
        });

        let remainingToDeduct = qty;
        let processError = null;

        for (const batch of batches) {
          if (remainingToDeduct <= 0) break;
          const deductAmount = Math.min(batch.cantidad_disponible, remainingToDeduct);

          db.run(
            "UPDATE inventory_batches SET cantidad_disponible = cantidad_disponible - ? WHERE id = ?",
            [deductAmount, batch.id],
            (err) => {
              if (err) processError = err;
            }
          );

          db.run(
            "INSERT INTO inventory_transactions (batch_id, tipo, cantidad, motivo) VALUES (?, ?, ?, ?)",
            [batch.id, tipo, deductAmount, motivo || 'Uso o Ajuste'],
            (err) => {
              if (err) processError = err;
            }
          );

          remainingToDeduct -= deductAmount;
        }

        db.run(processError ? 'ROLLBACK' : 'COMMIT', (err) => {
          if (err || processError) reject(err || processError);
          else resolve();
        });
      });
    });

    return res.status(200).json({ success: true, message: 'Salida/Ajuste registrado con éxito' });
  }

  throw new AppError('Tipo de transacción inválida', 400);
});

exports.getTreatmentMaterials = catchAsync(async (req, res, next) => {
  const { treatmentId } = req.params;
  const materials = await new Promise((resolve, reject) => {
    db.all(`
      SELECT tm.*, i.nombre 
      FROM treatment_materials tm
      JOIN inventory_items i ON tm.item_id = i.id
      WHERE tm.treatment_id = ?
    `, [treatmentId], (err, rows) => {
      if (err) reject(err); else resolve(rows);
    });
  });
  res.status(200).json({ success: true, data: materials });
});

exports.saveTreatmentMaterials = catchAsync(async (req, res, next) => {
  const { treatment_id, materials } = req.body;
  
  if (!treatment_id) throw new AppError('Treatment ID is required', 400);
  
  // Clean up old ones
  await new Promise((resolve, reject) => {
    db.run("DELETE FROM treatment_materials WHERE treatment_id = ?", [treatment_id], (err) => {
      if (err) reject(err); else resolve();
    });
  });

  // Insert new ones
  if (materials && materials.length > 0) {
    for (const m of materials) {
      await new Promise((resolve, reject) => {
        db.run("INSERT INTO treatment_materials (treatment_id, item_id, cantidad_requerida) VALUES (?, ?, ?)",
          [treatment_id, m.item_id, m.cantidad_requerida], (err) => {
            if (err) reject(err); else resolve();
          });
      });
    }
  }

  res.status(200).json({ success: true, message: 'Materiales vinculados con éxito' });
});
