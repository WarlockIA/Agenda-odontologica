const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.db');
const electronDbPath = path.join(process.env.APPDATA || '', 'agenda-odontologica', 'database.db');

console.log('===================================================');
console.log(' GENERANDO DATOS DE INVENTARIO ODONTOLÓGICO COMPLETO');
console.log(' (Proveedores, Artículos, Lotes con Alertas y Movimientos)');
console.log('===================================================');

const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }

  try {
    await seedInventory(db);
    console.log('\n✅ Inventario generado exitosamente en database.db local.');

    if (fs.existsSync(electronDbPath)) {
      fs.copyFileSync(dbPath, electronDbPath);
      console.log('✅ Base de datos sincronizada con AppData (Electron).');
    }

    db.close();
  } catch (error) {
    console.error('❌ Error durante la generación del inventario:', error);
    db.close();
  }
});

function runQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function getAllQuery(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function seedInventory(db) {
  // 1. Limpiar datos de inventario
  await runQuery(db, 'DELETE FROM inventory_transactions');
  await runQuery(db, 'DELETE FROM inventory_batches');
  await runQuery(db, 'DELETE FROM inventory_items');
  await runQuery(db, 'DELETE FROM inventory_suppliers');
  await runQuery(db, "UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('inventory_transactions', 'inventory_batches', 'inventory_items', 'inventory_suppliers')");

  // 2. Insertar Proveedores Ficticios Realistas
  console.log('Registrando proveedores...');
  const suppliersData = [
    { nombre: 'DENTAL BOLIVIA S.R.L.', contacto: 'Ing. Roberto Vargas', tel: '44221100', email: 'ventas@dentalbolivia.com.bo' },
    { nombre: 'IMPORTADORA DENT-MED', contacto: 'Lic. Patricia Morales', tel: '44556677', email: 'contacto@dentmed.bo' },
    { nombre: 'ODONTO-DISTRIBUIDORA ANDINA', contacto: 'Carlos Quiroga', tel: '44889900', email: 'pedidos@odontoandina.com' },
    { nombre: 'PRODENT SURAMÉRICA', contacto: 'Dra. Mónica Baldivieso', tel: '71239988', email: 'soporte@prodentsur.com' }
  ];

  const suppIds = [];
  for (const s of suppliersData) {
    const res = await runQuery(db, `
      INSERT INTO inventory_suppliers (nombre_empresa, contacto, telefono, email)
      VALUES (?, ?, ?, ?)
    `, [s.nombre, s.contacto, s.tel, s.email]);
    suppIds.push(res.lastID);
  }

  // 3. Insertar Artículos Odontológicos
  console.log('Registrando artículos odontológicos por categoría...');
  const itemsData = [
    // Anestésicos y Farmacología
    { nombre: 'Lidocaína 2% con Epinefrina 1:100.000 (Caja x50)', cat: 'Anestésicos', unidad: 'Caja', min: 5 },
    { nombre: 'Mepivacaína 3% sin Vasoconstrictor (Caja x50)', cat: 'Anestésicos', unidad: 'Caja', min: 3 },
    { nombre: 'Agujas Cortas Odontológicas 30G (Caja x100)', cat: 'Anestésicos', unidad: 'Caja', min: 4 },

    // Restauración y Resinas
    { nombre: 'Resina Fotocurable Filtek Z250 Tono A2 (3M)', cat: 'Restauración', unidad: 'Jeringa 4g', min: 4 },
    { nombre: 'Resina Fotocurable Filtek Z250 Tono A3 (3M)', cat: 'Restauración', unidad: 'Jeringa 4g', min: 4 },
    { nombre: 'Adhesivo Dental Single Bond Universal (3M)', cat: 'Restauración', unidad: 'Frasco 5ml', min: 2 },
    { nombre: 'Ácido Grabador Fosfórico 37% (Jeringa 3ml)', cat: 'Restauración', unidad: 'Jeringa 3ml', min: 3 },
    { nombre: 'Ionómero de Vidrio Type II Restauración (3M Kit)', cat: 'Restauración', unidad: 'Kit', min: 2 },

    // Endodoncia
    { nombre: 'Limas K-File 25mm 1ra Serie #15-40 (Dentsply)', cat: 'Endodoncia', unidad: 'Caja x6', min: 5 },
    { nombre: 'Limas NiTi Protaper Gold para Motor (Set Assorted)', cat: 'Endodoncia', unidad: 'Set', min: 3 },
    { nombre: 'Conos de Gutapercha 2da Serie #45-80', cat: 'Endodoncia', unidad: 'Caja', min: 3 },
    { nombre: 'Cemento Endodóntico AH Plus (Dentsply)', cat: 'Endodoncia', unidad: 'Kit', min: 1 },
    { nombre: 'Hipoclorito de Sodio 5.25% Irrigación (1 Litro)', cat: 'Endodoncia', unidad: 'Frasco 1L', min: 2 },

    // Cirugía y Periodoncia
    { nombre: 'Hojas de Bisturí Acero Inoxidable #15 (Caja x100)', cat: 'Cirugía', unidad: 'Caja', min: 2 },
    { nombre: 'Sutura Seda Negra 3-0 con Aguja Curva (Caja x12)', cat: 'Cirugía', unidad: 'Caja', min: 3 },
    { nombre: 'Esponja Hemostática de Gelatina Absorcol (Caja x10)', cat: 'Cirugía', unidad: 'Caja', min: 2 },

    // Desechables y Bioseguridad
    { nombre: 'Guantes de Nitrilo Sin Polvo Talla M (Caja x100)', cat: 'Bioseguridad', unidad: 'Caja', min: 10 },
    { nombre: 'Mascarillas Quirúrgicas 3 Pliegues KN95 (Caja x50)', cat: 'Bioseguridad', unidad: 'Caja', min: 8 },
    { nombre: 'Eyectores de Saliva Desechables (Bolsa x100)', cat: 'Bioseguridad', unidad: 'Bolsa', min: 5 },
    { nombre: 'Campos Quirúrgicos Impermeables Desechables', cat: 'Bioseguridad', unidad: 'Paquete x50', min: 4 },

    // Ortodoncia
    { nombre: 'Brackets Metálicos Roth 0.022" (Set Completo 20u)', cat: 'Ortodoncia', unidad: 'Set', min: 3 },
    { nombre: 'Arcos NiTi Térmicos 0.014 Superior/Inferior (Pack x10)', cat: 'Ortodoncia', unidad: 'Paquete', min: 4 },
    { nombre: 'Módulos Elásticos Ligaduras Colores Variados', cat: 'Ortodoncia', unidad: 'Bolsa 1000u', min: 2 }
  ];

  const itemMap = [];
  for (const it of itemsData) {
    const res = await runQuery(db, `
      INSERT INTO inventory_items (nombre, categoria, unidad_medida, stock_minimo)
      VALUES (?, ?, ?, ?)
    `, [it.nombre, it.cat, it.unidad, it.min]);
    itemMap.push({ id: res.lastID, ...it });
  }

  // 4. Registrar Lotes con Estados Realistas (Normales, Próximos a Vencer y Stock Bajo)
  console.log('Registrando lotes de inventario...');
  const batchesData = [
    // Lotes Normales (Vencimientos 2027-2028, stock adecuado)
    { itemIdx: 0, suppIdx: 0, lote: 'LOT-LIDO-2026', cad: '2028-04-15', costo: 180.00, in: 25, disp: 18 },
    { itemIdx: 1, suppIdx: 0, lote: 'LOT-MEPI-2026', cad: '2027-11-30', costo: 195.00, in: 15, disp: 12 },
    { itemIdx: 2, suppIdx: 1, lote: 'LOT-AGU-9021', cad: '2028-01-20', costo: 45.00, in: 30, disp: 22 },
    { itemIdx: 3, suppIdx: 0, lote: 'LOT-3M-A2-55', cad: '2027-09-10', costo: 140.00, in: 12, disp: 9 },
    { itemIdx: 4, suppIdx: 0, lote: 'LOT-3M-A3-88', cad: '2027-10-05', costo: 140.00, in: 12, disp: 8 },
    { itemIdx: 5, suppIdx: 1, lote: 'LOT-SING-440', cad: '2027-08-15', costo: 320.00, in: 6, disp: 4 },
    { itemIdx: 8, suppIdx: 2, lote: 'LOT-LIM-25K', cad: '2028-06-30', costo: 85.00, in: 20, disp: 15 },
    { itemIdx: 9, suppIdx: 2, lote: 'LOT-PROT-GOLD', cad: '2027-12-15', costo: 210.00, in: 10, disp: 7 },
    { itemIdx: 13, suppIdx: 3, lote: 'LOT-BIST-15X', cad: '2028-03-01', costo: 60.00, in: 10, disp: 7 },
    { itemIdx: 16, suppIdx: 1, lote: 'LOT-GUA-NIT-M', cad: '2027-07-20', costo: 55.00, in: 40, disp: 28 },
    { itemIdx: 18, suppIdx: 1, lote: 'LOT-EYEC-SAL', cad: '2028-02-10', costo: 35.00, in: 20, disp: 14 },
    { itemIdx: 20, suppIdx: 3, lote: 'LOT-ROTH-22', cad: '2029-01-01', costo: 250.00, in: 15, disp: 11 },

    // LOTE PRÓXIMO A VENCER (Alerta Amarilla - Agosto/Septiembre 2026)
    { itemIdx: 6, suppIdx: 0, lote: 'LOT-EXP-GRAB-37', cad: '2026-08-28', costo: 40.00, in: 15, disp: 6 },
    { itemIdx: 11, suppIdx: 2, lote: 'LOT-EXP-AHPLUS', cad: '2026-09-12', costo: 420.00, in: 5, disp: 2 },

    // LOTE CON STOCK BAJO (Alerta Roja - Cantidad Disponible <= Stock Mínimo)
    { itemIdx: 7, suppIdx: 0, lote: 'LOT-ION-LOW-02', cad: '2027-05-10', costo: 280.00, in: 8, disp: 1 },
    { itemIdx: 14, suppIdx: 3, lote: 'LOT-SUT-SEDA-3', cad: '2027-04-18', costo: 110.00, in: 10, disp: 2 },
    { itemIdx: 15, suppIdx: 3, lote: 'LOT-GEL-HEMO-01', cad: '2027-03-25', costo: 130.00, in: 6, disp: 1 },

    // LOTE VENCIDO RECIENTEMENTE (Alerta Roja Vencimiento - Julio 2026)
    { itemIdx: 17, suppIdx: 1, lote: 'LOT-MASC-KN95-V', cad: '2026-07-20', costo: 70.00, in: 25, disp: 5 }
  ];

  const batchMap = [];
  for (const b of batchesData) {
    const item = itemMap[b.itemIdx];
    const suppId = suppIds[b.suppIdx];

    const res = await runQuery(db, `
      INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [item.id, suppId, b.lote, b.cad, b.costo, b.in, b.disp]);

    batchMap.push({ id: res.lastID, ...b, item_id: item.id });
  }

  // 5. Registrar Transacciones / Movimientos de Ejemplo
  console.log('Registrando historial de movimientos de inventario...');
  const dateStr = '2026-08-04';

  for (const b of batchMap) {
    // Entrada inicial
    await runQuery(db, `
      INSERT INTO inventory_transactions (batch_id, tipo, cantidad, motivo, fecha)
      VALUES (?, 'ENTRADA', ?, 'Recepción e ingreso inicial de lote por compra a proveedor', ?)
    `, [b.id, b.in, '2026-08-01']);

    // Salida si hubo consumo
    const consumo = b.in - b.disp;
    if (consumo > 0) {
      await runQuery(db, `
        INSERT INTO inventory_transactions (batch_id, tipo, cantidad, motivo, fecha)
        VALUES (?, 'SALIDA', ?, 'Consumo clínico acumulado en atenciones odontológicas', ?)
      `, [b.id, consumo, dateStr]);
    }
  }

  console.log('===================================================');
  console.log(` Total Proveedores: ${suppliersData.length}`);
  console.log(` Total Artículos Odontológicos: ${itemsData.length}`);
  console.log(` Total Lotes Registrados: ${batchesData.length}`);
  console.log('===================================================');
}
