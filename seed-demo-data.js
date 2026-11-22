const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'database.db');
const electronDbPath = path.join(process.env.APPDATA || '', 'agenda-odontologica', 'database.db');

console.log('===================================================');
console.log(' GENERANDO DATOS DE DEMOSTRACIÓN COMPLETOS');
console.log(' (Agenda semanal activa, historial de 12 meses e inventario)');
console.log('===================================================');

const db = new sqlite3.Database(dbPath, async (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }

  try {
    await runSeed(db);
    console.log('\n✅ Generación de datos completada exitosamente en database.db local.');

    // Si existe la BD de Electron en AppData, actualizarla también
    if (fs.existsSync(electronDbPath)) {
      fs.copyFileSync(dbPath, electronDbPath);
      console.log('✅ Copia actualizada en la base de datos de Electron (AppData).');
    }

    db.close();
  } catch (error) {
    console.error('❌ Error durante la generación de datos:', error);
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

async function runSeed(db) {
  // 1. Limpiar datos anteriores
  await runQuery(db, 'DELETE FROM appointment_treatments');
  await runQuery(db, 'DELETE FROM evolucion_tratamientos');
  await runQuery(db, 'DELETE FROM appointments');
  await runQuery(db, 'DELETE FROM patients');
  await runQuery(db, 'DELETE FROM inventory_batches');
  await runQuery(db, 'DELETE FROM inventory_suppliers');
  await runQuery(db, "UPDATE sqlite_sequence SET seq = 0 WHERE name IN ('patients', 'appointments', 'evolucion_tratamientos', 'inventory_batches', 'inventory_suppliers')");

  // 2. Lista de Pacientes Ficticios Realistas
  const patientsData = [
    { nombre: 'Carlos Eduardo Mendoza Vaca', ci: '7891234 LP', cel: '71234567', edad: 34, sexo: 'M', profesion: 'Ingeniero Comercial', diagnostico: 'Caries oclusal en pieza 36 y gingivitis leve.' },
    { nombre: 'María Elena Claros Torrico', ci: '6543210 CB', cel: '76543210', edad: 28, sexo: 'F', profesion: 'Arquitecta', diagnostico: 'Pulpitis irreversible en pieza 16. Requiere endodoncia.' },
    { nombre: 'Javier Alejandro Flores Rios', ci: '8912345 SC', cel: '78912345', edad: 45, sexo: 'M', profesion: 'Contador Público', diagnostico: 'Periodontitis moderada. Acumulo severo de sarro en anteroinferiores.' },
    { nombre: 'Ana Sofía Gutierrez Vargas', ci: '5432109 OR', cel: '75432109', edad: 22, sexo: 'F', profesion: 'Estudiante Universitaria', diagnostico: 'Apiñamiento anteroinferior Grado II. Indicación de ortodoncia.' },
    { nombre: 'Rodrigo Fernando Mamani Quispe', ci: '4321098 PT', cel: '74321098', edad: 52, sexo: 'M', profesion: 'Docente Universitario', diagnostico: 'Pérdida de piezas 24 y 25. Evaluación para puente o prótesis.' },
    { nombre: 'Valeria Nicole Paredes Soliz', ci: '9123456 CH', cel: '79123456', edad: 31, sexo: 'F', profesion: 'Diseñadora Gráfica', diagnostico: 'Caries interproximal entre piezas 11 y 12. Manchado estético.' },
    { nombre: 'Diego Andrés Roca Justiniano', ci: '3210987 TJ', cel: '73210987', edad: 39, sexo: 'M', profesion: 'Abogado', diagnostico: 'Bruxismo nocturno severo. Desgaste en bordes incisales.' },
    { nombre: 'Claudia Patricia Benitez Suarez', ci: '2109876 BE', cel: '72109876', edad: 41, sexo: 'F', profesion: 'Administradora de Empresas', diagnostico: 'Fractura coronal parcial en pieza 21 por traumatismo.' },
    { nombre: 'Gonzalo Ariel Morales Ortiz', ci: '8765432 LP', cel: '78765432', edad: 29, sexo: 'M', profesion: 'Programador de Software', diagnostico: 'Terceros molares retenidos (38 y 48) con pericoronaritis ocasional.' },
    { nombre: 'Camila Andrea Pinto Camacho', ci: '7654321 CB', cel: '77654321', edad: 25, sexo: 'F', profesion: 'Comunicadora Social', diagnostico: 'Sensibilidad dentinaria generalizada. Limpieza y fluorización recomendada.' },
    { nombre: 'Marcelo Hugo Soria Galvarro', ci: '6543219 SC', cel: '76543219', edad: 48, sexo: 'M', profesion: 'Comerciante', diagnostico: 'Caries radicular en pieza 44. Higiene deficiente.' },
    { nombre: 'Lucía Belén Aramayo Hurtado', ci: '5432108 OR', cel: '75432108', edad: 36, sexo: 'F', profesion: 'Médico Cirujano', diagnostico: 'Filtración marginal en restauración antigua de amalgama pieza 46.' },
    { nombre: 'Ernesto Daniel Villarroel Chavez', ci: '4321097 PT', cel: '74321097', edad: 60, sexo: 'M', profesion: 'Jubilado', diagnostico: 'Edentulismo parcial superior e inferior. Adaptación de prótesis removible.' },
    { nombre: 'Jimena Paola Camacho Lopez', ci: '9876543 TJ', cel: '79876543', edad: 33, sexo: 'F', profesion: 'Psicóloga', diagnostico: 'Pigmentación por consumo de café y té. Solicitud de blanqueamiento.' },
    { nombre: 'Fabian Mateo Terrazas Paz', ci: '8765431 CH', cel: '78765431', edad: 19, sexo: 'M', profesion: 'Estudiante', diagnostico: 'Control post-tratamiento de ortodoncia. Limpieza y profilaxis.' },
    { nombre: 'Natalia Alejandra Balderrama Melgar', ci: '7654320 BE', cel: '77654320', edad: 27, sexo: 'F', profesion: 'Chef Profesional', diagnostico: 'Erosión del esmalte por reflujo. Aplicación de barniz fluorado.' },
    { nombre: 'Oscar Mauricio Zabala Siles', ci: '6543218 LP', cel: '76543218', edad: 55, sexo: 'M', profesion: 'Economista', diagnostico: 'Lesión periapical en pieza 35. Tratamiento de conducto indicado.' },
    { nombre: 'Andrea Isabel Cordova Rios', ci: '5432107 CB', cel: '75432107', edad: 38, sexo: 'F', profesion: 'Odontopediatra', diagnostico: 'Revisión periódica y mantenimiento profiláctico semestral.' },
    { nombre: 'Jorge Luis Suarez Vaca', ci: '4321096 SC', cel: '74321096', edad: 44, sexo: 'M', profesion: 'Piloto Civil', diagnostico: 'Caries amelo-dentinaria piezas 14, 15 y 26.' },
    { nombre: 'Pamela Beatriz Ferrufino Mercado', ci: '3210985 OR', cel: '73210985', edad: 30, sexo: 'F', profesion: 'Auditora', diagnostico: 'Dolor agudo a la masticación en molar 37. Posible fisura vertical.' },
    { nombre: 'Sergio Gabriel Alarcon Nunez', ci: '2109874 PT', cel: '72109874', edad: 47, sexo: 'M', profesion: 'Empresario', diagnostico: 'Gingivitis descamativa crónica. Tratamiento periodontal intensivo.' },
    { nombre: 'Daniela Fernanda Saucedo Justiniano', ci: '1098763 CH', cel: '71098763', edad: 24, sexo: 'F', profesion: 'Mercadóloga', diagnostico: 'Estética dental. Corrección de diastema con resina fotocurable.' },
    { nombre: 'Gabriel Ignacio Guzman Arce', ci: '9087652 TJ', cel: '79087652', edad: 37, sexo: 'M', profesion: 'Ingeniero de Sistemas', diagnostico: 'Restauración desprendida en pieza 45. Reconstrucción con perno.' },
    { nombre: 'Jessica Paola Montero Ortiz', ci: '8076541 BE', cel: '78076541', edad: 32, sexo: 'F', profesion: 'Nutricionista', diagnostico: 'Dientes colindantes con ligera descalcificación oclusal.' },
    { nombre: 'Alejandro Jose Quiroga Barrientos', ci: '7065430 LP', cel: '77065430', edad: 50, sexo: 'M', profesion: 'Arquitecto de Interiores', diagnostico: 'Pericoronaritis recurrente pieza 48. Exodoncia quirúrgica programada.' }
  ];

  console.log(`Registrando ${patientsData.length} pacientes...`);
  const insertedPatients = [];

  for (let i = 0; i < patientsData.length; i++) {
    const p = patientsData[i];
    const res = await runQuery(db, `
      INSERT INTO patients (ficha_nro, nombre_completo, profesion_ocupacion, fecha_nacimiento, edad, domicilio, sexo, ciudad_localidad, telefono, ci, examen_extraoral, diagnostico_presuntivo, notas_medicas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      i + 1,
      p.nombre,
      p.profesion,
      `19${98 - (p.edad % 30)}-0${(i % 9) + 1}-15`,
      p.edad,
      `Av. Principal #${100 + i * 15}, Zona Central`,
      p.sexo,
      'Cochabamba',
      p.cel,
      p.ci,
      'Sin hallazgos patológicos extraorales de relieve. ATM asintomática.',
      p.diagnostico,
      'Paciente puntual con buena predisposición al tratamiento.'
    ]);
    insertedPatients.push({ id: res.lastID, nombre: p.nombre, cel: p.cel });
  }

  // 3. Cargar tratamientos del catálogo
  const treatments = await getAllQuery(db, 'SELECT id, nombre, costo_base, categoria FROM treatments WHERE activo = 1 AND eliminado = 0');
  if (treatments.length === 0) {
    throw new Error('No se encontraron tratamientos en el catálogo.');
  }

  console.log(`Poblando citas e historial clínico para las 2 semanas continuas de atención (10 al 21 de Agosto de 2026)...`);

  const teethNumbers = [11, 12, 14, 16, 21, 24, 26, 31, 36, 44, 46, 48];
  let appointmentCount = 0;
  let evolutionCount = 0;

  // 4. REGISTRO CONTINUO DE USO REAL (2 SEMANAS DE CLINICA DENTAL: 10 AL 21 DE AGOSTO DE 2026)
  console.log(`Generando datos de atención continua para las semanas del 10 al 15 de Agosto y del 17 al 21 de Agosto de 2026...`);

  const weekSchedule = [
    // --- SEMANA 1 (10 al 15 de Agosto 2026) ---
    { date: '2026-08-10', time: '08:30', patientIdx: 0, status: 'Completada', treatIdx: 0, note: 'Limpieza dental y profilaxis de rutina.' },
    { date: '2026-08-10', time: '10:00', patientIdx: 1, status: 'Completada', treatIdx: 2, note: 'Evaluación y apertura de conducto pieza 16.' },
    { date: '2026-08-10', time: '11:30', patientIdx: 2, status: 'Completada', treatIdx: 1, note: 'Exodoncia de pieza comprometida.' },
    { date: '2026-08-10', time: '14:30', patientIdx: 3, status: 'Completada', treatIdx: 4, note: 'Control de brackets y ajuste de arcos.' },

    { date: '2026-08-11', time: '09:00', patientIdx: 4, status: 'Completada', treatIdx: 3, note: 'Primera sesión de endodoncia.' },
    { date: '2026-08-11', time: '10:30', patientIdx: 5, status: 'Completada', treatIdx: 0, note: 'Profilaxis ultrasónica.' },
    { date: '2026-08-11', time: '15:00', patientIdx: 6, status: 'Completada', treatIdx: 5, note: 'Restauración estética con resina.' },

    { date: '2026-08-12', time: '08:30', patientIdx: 7, status: 'Completada', treatIdx: 1, note: 'Extracción simple cuadrante superior.' },
    { date: '2026-08-12', time: '10:00', patientIdx: 8, status: 'Completada', treatIdx: 6, note: 'Sesión de blanqueamiento dental LED.' },
    { date: '2026-08-12', time: '14:30', patientIdx: 9, status: 'Completada', treatIdx: 2, note: 'Obturación con resina fotocurable.' },

    { date: '2026-08-13', time: '09:00', patientIdx: 10, status: 'Completada', treatIdx: 0, note: 'Limpieza e higiene oral.' },
    { date: '2026-08-13', time: '11:00', patientIdx: 11, status: 'Completada', treatIdx: 3, note: 'Conclusión de tratamiento de conducto.' },
    { date: '2026-08-13', time: '16:00', patientIdx: 12, status: 'Completada', treatIdx: 4, note: 'Mantenimiento periódico de ortodoncia.' },

    { date: '2026-08-14', time: '08:30', patientIdx: 13, status: 'Completada', treatIdx: 5, note: 'Reconstrucción coronal con resina.' },
    { date: '2026-08-14', time: '10:30', patientIdx: 14, status: 'Completada', treatIdx: 1, note: 'Exodoncia de molar inferior.' },
    { date: '2026-08-14', time: '15:00', patientIdx: 15, status: 'Completada', treatIdx: 0, note: 'Limpieza profunda y fluorización.' },

    // Sábado 15 de Agosto (Jornada Completa de Sábado)
    { date: '2026-08-15', time: '09:00', patientIdx: 16, status: 'Completada', treatIdx: 2, note: 'Curación de caries oclusal pieza 36.' },
    { date: '2026-08-15', time: '10:30', patientIdx: 17, status: 'Completada', treatIdx: 0, note: 'Revisión general y profilaxis ultrasónica.' },
    { date: '2026-08-15', time: '14:30', patientIdx: 18, status: 'Completada', treatIdx: 5, note: 'Restauración estética con resina.' },
    { date: '2026-08-15', time: '16:00', patientIdx: 19, status: 'Completada', treatIdx: 1, note: 'Control de cicatrización pos-exodoncia.' },

    // --- SEMANA 2 ACTIVA REQUERIDA POR EL CLIENTE (17 al 22 de Agosto 2026) ---
    { date: '2026-08-17', time: '08:30', patientIdx: 0, status: 'Completada', treatIdx: 0, note: 'Limpieza dental y tartrectomía ultrasonido pieza 36.' },
    { date: '2026-08-17', time: '10:00', patientIdx: 1, status: 'Completada', treatIdx: 3, note: 'Endodoncia unirradicular 1a sesión pieza 16.' },
    { date: '2026-08-17', time: '11:30', patientIdx: 2, status: 'Completada', treatIdx: 2, note: 'Curetaje y alisado radicular periodontal.' },
    { date: '2026-08-17', time: '14:30', patientIdx: 3, status: 'Completada', treatIdx: 4, note: 'Evaluación de ortodoncia y toma de impresiones.' },
    { date: '2026-08-17', time: '16:00', patientIdx: 4, status: 'Completada', treatIdx: 5, note: 'Tallado para prótesis fija y provisional piezas 24-25.' },

    { date: '2026-08-18', time: '08:30', patientIdx: 5, status: 'Completada', treatIdx: 0, note: 'Obturación con resina fotocurable clase IV pieza 11.' },
    { date: '2026-08-18', time: '10:00', patientIdx: 6, status: 'Completada', treatIdx: 2, note: 'Toma de impresión para placa miorelajante bruxismo.' },
    { date: '2026-08-18', time: '11:30', patientIdx: 7, status: 'Completada', treatIdx: 5, note: 'Reconstrucción estética por fractura coronal pieza 21.' },
    { date: '2026-08-18', time: '15:00', patientIdx: 8, status: 'Completada', treatIdx: 1, note: 'Exodoncia quirúrgica de tercer molar pieza 48.' },

    { date: '2026-08-19', time: '08:30', patientIdx: 9, status: 'Completada', treatIdx: 6, note: 'Blanqueamiento dental LED y barniz fluorado.' },
    { date: '2026-08-19', time: '10:00', patientIdx: 10, status: 'Completada', treatIdx: 2, note: 'Reestructuración radicular en resina pieza 44.' },
    { date: '2026-08-19', time: '11:30', patientIdx: 11, status: 'Completada', treatIdx: 5, note: 'Reemplazo de amalgama por resina pieza 46.' },
    { date: '2026-08-19', time: '14:30', patientIdx: 12, status: 'Completada', treatIdx: 7, note: 'Prueba de articulación de prótesis removible.' },
    { date: '2026-08-19', time: '16:00', patientIdx: 13, status: 'Completada', treatIdx: 0, note: 'Profilaxis con bicarbonato y pulido.' },

    { date: '2026-08-20', time: '08:30', patientIdx: 14, status: 'Completada', treatIdx: 4, note: 'Control mensual de ortodoncia y ajuste de ligas.' },
    { date: '2026-08-20', time: '10:00', patientIdx: 15, status: 'Completada', treatIdx: 0, note: 'Desensibilización dentinaria y aplicación de flúor.' },
    { date: '2026-08-20', time: '11:30', patientIdx: 16, status: 'Completada', treatIdx: 3, note: 'Endodoncia 2da sesión y obturación de conductos pieza 35.' },
    { date: '2026-08-20', time: '15:00', patientIdx: 17, status: 'Completada', treatIdx: 0, note: 'Revisión semestral profiláctica.' },
    { date: '2026-08-20', time: '16:30', patientIdx: 18, status: 'Completada', treatIdx: 2, note: 'Obturación estética múltiple piezas 14, 15 y 26.' },

    { date: '2026-08-21', time: '08:30', patientIdx: 19, status: 'Completada', treatIdx: 3, note: 'Diagnóstico periapical y endodoncia molar 37.' },
    { date: '2026-08-21', time: '10:00', patientIdx: 20, status: 'Completada', treatIdx: 2, note: 'Limpieza periodontal profunda y tratamiento gingival.' },
    { date: '2026-08-21', time: '11:30', patientIdx: 21, status: 'Completada', treatIdx: 5, note: 'Cierre de diastema con resina fotocurable piezas 11-21.' },
    { date: '2026-08-21', time: '14:30', patientIdx: 22, status: 'Completada', treatIdx: 5, note: 'Reconstrucción coronal con perno de fibra de vidrio pieza 45.' },
    { date: '2026-08-21', time: '16:00', patientIdx: 23, status: 'Completada', treatIdx: 0, note: 'Aplicación de sellantes de fosas y fisuras en premolares.' },
    { date: '2026-08-21', time: '17:30', patientIdx: 24, status: 'Completada', treatIdx: 1, note: 'Evaluación pre-quirúrgica y retiro de puntos de sutura.' },

    // --- SÁBADO 22 DE AGOSTO (Jornada Activa de Sábado) ---
    { date: '2026-08-22', time: '08:30', patientIdx: 0, status: 'Completada', treatIdx: 0, note: 'Control post-limpieza y aplicación de flúor.' },
    { date: '2026-08-22', time: '09:30', patientIdx: 3, status: 'Completada', treatIdx: 4, note: 'Ajuste de brackets y arco ortodóncico.' },
    { date: '2026-08-22', time: '10:30', patientIdx: 1, status: 'En Espera', treatIdx: 3, note: 'Paciente en sala de espera para 2da sesión endodoncia.' },
    { date: '2026-08-22', time: '11:30', patientIdx: 2, status: 'Programada', treatIdx: 2, note: 'Mantenimiento periodontal programado.' },
    { date: '2026-08-22', time: '14:30', patientIdx: 5, status: 'Programada', treatIdx: 0, note: 'Profilaxis y pulido estético.' },
    { date: '2026-08-22', time: '16:00', patientIdx: 7, status: 'Programada', treatIdx: 5, note: 'Evaluación de prótesis y entrega.' }
  ];

  for (const item of weekSchedule) {
    const patient = insertedPatients[item.patientIdx % insertedPatients.length];
    const treatment = treatments[item.treatIdx % treatments.length];

    const apptRes = await runQuery(db, `
      INSERT INTO appointments (patient_name, patient_phone, treatment, appointment_date, appointment_time, status, created_by, patient_id, observaciones_clinicas)
      VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
    `, [
      patient.nombre,
      patient.cel,
      treatment.nombre,
      item.date,
      item.time,
      item.status,
      patient.id,
      item.note || `Cita de ${treatment.nombre}.`
    ]);

    await runQuery(db, `
      INSERT INTO appointment_treatments (appointment_id, treatment_id, costo_aplicado)
      VALUES (?, ?, ?)
    `, [apptRes.lastID, treatment.id, treatment.costo_base]);

    if (item.status === 'Completada') {
      const costo = treatment.costo_base;
      await runQuery(db, `
        INSERT INTO evolucion_tratamientos (paciente_id, fecha, diente_nro, trabajo_realizado, debe, haber, saldo)
        VALUES (?, ?, ?, ?, ?, ?, 0)
      `, [
        patient.id,
        item.date,
        teethNumbers[item.patientIdx % teethNumbers.length],
        treatment.nombre,
        costo,
        costo
      ]);
      evolutionCount++;
    }
    appointmentCount++;
  }

  // 6. Proveedores y Lotes de Inventario
  console.log('Registrando proveedores y lotes de inventario...');
  const supp1 = await runQuery(db, "INSERT INTO inventory_suppliers (nombre_empresa, telefono) VALUES ('DENTAL BOLIVIA S.R.L.', '44221100')");
  const supp2 = await runQuery(db, "INSERT INTO inventory_suppliers (nombre_empresa, telefono) VALUES ('IMPORTADORA DENT-MED', '44556677')");

  const items = await getAllQuery(db, 'SELECT id, nombre FROM inventory_items LIMIT 10');
  if (items.length > 0) {
    // Lote normal
    await runQuery(db, `
      INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible)
      VALUES (?, ?, 'LOT-2026-A1', '2027-12-31', 45.00, 100, 85)
    `, [items[0].id, supp1.lastID]);

    // Lote próximo a vencer (warning)
    if (items[1]) {
      await runQuery(db, `
        INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible)
        VALUES (?, ?, 'LOT-EXP-2026', '2026-08-25', 120.00, 50, 12)
      `, [items[1].id, supp2.lastID]);
    }

    // Lote agotándose (stock bajo)
    if (items[2]) {
      await runQuery(db, `
        INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible)
        VALUES (?, ?, 'LOT-LOW-09', '2027-05-15', 30.00, 40, 2)
      `, [items[2].id, supp1.lastID]);
    }
  }

  console.log(`\n===================================================`);
  console.log(` Total Pacientes: ${insertedPatients.length}`);
  console.log(` Total Citas (2 Semanas Continuas de Atención): ${appointmentCount}`);
  console.log(` Total Historiales de Evolución Registrados: ${evolutionCount}`);
  console.log(`===================================================`);
}
