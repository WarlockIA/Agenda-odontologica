const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './database.db');
const schemaPath = path.resolve(__dirname, '../schema.sql');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const developmentUserSeeds = `
  INSERT OR IGNORE INTO users (email, password_hash, name, role)
  VALUES ('admin@agendaodontologica.com', '$2a$12$66NPhCd6vcZFn0sK9Mz2xeCwIY54qmDeI/M.CNkLWyDY9ZZy6VjBK', 'Dr. Luis D. Reynaga Padilla', 'odontologo');
  INSERT OR IGNORE INTO users (email, password_hash, name, role)
  VALUES ('recepcion@agendaodontologica.com', '$2a$12$cdEn9IbENNCgUCMvyf5ZeulF0f6yD7uex.4peMgJ6eQN/22M2.r9i', 'Sra. Laura Gómez', 'recepcionista');
  INSERT OR IGNORE INTO users (email, password_hash, name, role)
  VALUES ('admin@dentalflow.com', '$2a$12$opgvHLoDAKk/aU/Rjf20VeIS4LAsJoMOtZGGVqscp9UOqhSm9p/z2', 'Dr. Luis D. Reynaga Padilla', 'odontologo');
`;

// Verificar si el archivo de base de datos ya existe
const dbExists = fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al abrir la base de datos:', err.message);
    process.exit(1);
  }
  console.log(`Conectado a la base de datos SQLite en: ${dbPath}`);
  
  db.run('PRAGMA foreign_keys = ON;', (err) => {
    if (err) {
      console.error('Error al habilitar foreign_keys:', err.message);
    } else {
      console.log('PRAGMA foreign_keys = ON habilitado');
    }
  });
  
  // Si la base de datos es nueva o no existía, inicializar el esquema
  if (!dbExists) {
    initializeDatabase();
  } else {
    // Asegurar que la tabla de pacientes exista (por si se está actualizando una BD ya existente)
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_completo TEXT NOT NULL,
            telefono TEXT,
            ci TEXT UNIQUE NOT NULL,
            notas_medicas TEXT,
            creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla patients:', err.message);
        }
      });
      db.run(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_ci ON patients(ci)
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia del índice idx_patients_ci:', err.message);
        }
      });
      db.run(`
        CREATE INDEX IF NOT EXISTS idx_patients_nombre_nocase ON patients(nombre_completo COLLATE NOCASE)
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia del índice idx_patients_nombre_nocase:', err.message);
        }
      });
      db.run(`
        CREATE TABLE IF NOT EXISTS treatments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT UNIQUE NOT NULL,
            costo_base REAL NOT NULL,
            activo INTEGER DEFAULT 1,
            color TEXT DEFAULT '#3b82f6',
            categoria TEXT DEFAULT 'General',
            eliminado INTEGER DEFAULT 0
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla treatments:', err.message);
        } else {
          db.run("INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Limpieza Dental', 50.0, 1)");
          db.run("INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Extracción Simple', 80.0, 1)");
          db.run("INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Endodoncia Unirradicular', 250.0, 1)");
        }
      });
      // Asegurar columna color, categoria y eliminado en la tabla treatments
      db.run("ALTER TABLE treatments ADD COLUMN color TEXT DEFAULT '#3b82f6'", () => {});
      db.run("ALTER TABLE treatments ADD COLUMN categoria TEXT DEFAULT 'General'", () => {});
      db.run("ALTER TABLE treatments ADD COLUMN eliminado INTEGER DEFAULT 0", () => {});
      // Asegurar columna patient_id en la tabla appointments (HU-009)
      db.run(`
        ALTER TABLE appointments ADD COLUMN patient_id INTEGER REFERENCES patients(id)
      `, (err) => {
        // Ignoramos el error si la columna ya existe
      });
      // Asegurar columna observaciones_clinicas en la tabla appointments (HU-011)
      db.run(`
        ALTER TABLE appointments ADD COLUMN observaciones_clinicas TEXT
      `, (err) => {
        // Ignoramos el error si la columna ya existe
      });
      // Asegurar existencia de la tabla intermedia appointment_treatments (HU-011)
      db.run(`
        CREATE TABLE IF NOT EXISTS appointment_treatments (
            appointment_id INTEGER NOT NULL,
            treatment_id INTEGER NOT NULL,
            costo_aplicado REAL NOT NULL,
            PRIMARY KEY (appointment_id, treatment_id),
            FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
            FOREIGN KEY (treatment_id) REFERENCES treatments(id)
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla appointment_treatments:', err.message);
        }
      });

      // Asegurar nuevas columnas para la digitalización de fichas médicas
      db.run("ALTER TABLE patients ADD COLUMN ficha_nro INTEGER", () => {});
      db.run("ALTER TABLE patients ADD COLUMN profesion_ocupacion TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN fecha_nacimiento TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN edad INTEGER", () => {});
      db.run("ALTER TABLE patients ADD COLUMN domicilio TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN sexo TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN ciudad_localidad TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN examen_extraoral TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN diagnostico_presuntivo TEXT", () => {});
      db.run("ALTER TABLE patients ADD COLUMN odontograma TEXT", () => {});
      db.run("CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_ficha_nro ON patients(ficha_nro)", () => {});

      // Asegurar existencia de la tabla de evolución y control de tratamientos
      db.run(`
        CREATE TABLE IF NOT EXISTS evolucion_tratamientos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            fecha TEXT NOT NULL DEFAULT (date('now')),
            diente_nro INTEGER,
            rx TEXT,
            trabajo_realizado TEXT NOT NULL,
            debe REAL NOT NULL DEFAULT 0.00,
            haber REAL NOT NULL DEFAULT 0.00,
            saldo REAL NOT NULL DEFAULT 0.00,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(paciente_id) REFERENCES patients(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla evolucion_tratamientos:', err.message);
        }
      });
      db.run(`CREATE INDEX IF NOT EXISTS idx_evolucion_paciente ON evolucion_tratamientos(paciente_id)`, () => {});

      // Asegurar existencia de la tabla patient_attachments
      db.run(`
        CREATE TABLE IF NOT EXISTS patient_attachments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            paciente_id INTEGER NOT NULL,
            file_name TEXT NOT NULL,
            file_path TEXT NOT NULL,
            mime_type TEXT NOT NULL,
            file_data TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(paciente_id) REFERENCES patients(id) ON DELETE CASCADE
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla patient_attachments:', err.message);
        }
      });
      db.run("ALTER TABLE patient_attachments ADD COLUMN file_data TEXT", () => {});
      db.run(`CREATE INDEX IF NOT EXISTS idx_attachments_paciente ON patient_attachments(paciente_id)`, () => {});

      // Asegurar existencia de la tabla clinic_exceptions
      db.run(`
        CREATE TABLE IF NOT EXISTS clinic_exceptions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            exception_date TEXT UNIQUE NOT NULL,
            description TEXT NOT NULL,
            is_recurring INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla clinic_exceptions:', err.message);
        } else {
          db.run(`ALTER TABLE clinic_exceptions ADD COLUMN is_recurring INTEGER DEFAULT 0`, (alterErr) => {
            // Ignorar si la columna ya existe
          });
        }
      });
      db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_exceptions_date ON clinic_exceptions(exception_date)`, () => {});

      // Asegurar existencia de la tabla working_hours (HU-003)
      db.run(`
        CREATE TABLE IF NOT EXISTS working_hours (
            day_of_week INTEGER PRIMARY KEY,
            activo INTEGER DEFAULT 1,
            mañana_inicio TEXT,
            mañana_fin TEXT,
            tarde_inicio TEXT,
            tarde_fin TEXT
        )
      `, (err) => {
        if (err) {
          console.error('Error al asegurar la existencia de la tabla working_hours:', err.message);
        } else {
          // Poblar con horario comercial por defecto
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (0, 0, NULL, NULL, NULL, NULL)");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (1, 1, '08:00', '12:00', '14:00', '18:00')");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (2, 1, '08:00', '12:00', '14:00', '18:00')");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (3, 1, '08:00', '12:00', '14:00', '18:00')");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (4, 1, '08:00', '12:00', '14:00', '18:00')");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (5, 1, '08:00', '12:00', '14:00', '18:00')");
          db.run("INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (6, 0, NULL, NULL, NULL, NULL)");
        }
      });

      // TABLAS DE INVENTARIO
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_suppliers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre_empresa TEXT NOT NULL,
            contacto TEXT,
            telefono TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run("ALTER TABLE inventory_suppliers ADD COLUMN contacto TEXT", () => {});
      db.run("ALTER TABLE inventory_suppliers ADD COLUMN email TEXT", () => {});
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            categoria TEXT,
            unidad_medida TEXT,
            stock_minimo INTEGER DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            item_id INTEGER NOT NULL,
            supplier_id INTEGER,
            numero_lote TEXT,
            fecha_caducidad TEXT,
            costo_unitario REAL DEFAULT 0.00,
            cantidad_inicial INTEGER NOT NULL,
            cantidad_disponible INTEGER NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
            FOREIGN KEY(supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_batches_item ON inventory_batches(item_id)`);
      db.run(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            tipo TEXT NOT NULL,
            cantidad INTEGER NOT NULL,
            motivo TEXT,
            fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY(batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE
        )
      `);
      db.run(`CREATE INDEX IF NOT EXISTS idx_transactions_batch ON inventory_transactions(batch_id)`);
      db.run(`
        CREATE TABLE IF NOT EXISTS treatment_materials (
            treatment_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            cantidad_requerida INTEGER NOT NULL DEFAULT 1,
            PRIMARY KEY (treatment_id, item_id),
            FOREIGN KEY(treatment_id) REFERENCES treatments(id) ON DELETE CASCADE,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
        )
      `);
      db.run(`
        CREATE TABLE IF NOT EXISTS appointment_consumables (
            evolucion_id INTEGER NOT NULL,
            item_id INTEGER NOT NULL,
            cantidad_usada INTEGER NOT NULL,
            PRIMARY KEY (evolucion_id, item_id),
            FOREIGN KEY(evolucion_id) REFERENCES evolucion_tratamientos(id) ON DELETE CASCADE,
            FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
        )
      `, () => {
        // Poblar semillas de insumos si la tabla está vacía
        db.get("SELECT COUNT(*) as count FROM inventory_items", [], (err, row) => {
          if (!err && row && row.count === 0) {
            db.serialize(() => {
              db.run("INSERT OR IGNORE INTO inventory_suppliers (id, nombre_empresa, telefono) VALUES (1, 'DentalMed Bolivia', '+591 70000000')");
              db.run("INSERT INTO inventory_items (id, nombre, categoria, unidad_medida, stock_minimo) VALUES (1, 'Resina Fotocurable A2', 'Restauración', 'Tubo', 5)");
              db.run("INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible) VALUES (1, 1, 'LOT-2026-A', '2026-12-31', 45.00, 10, 2)");

              db.run("INSERT INTO inventory_items (id, nombre, categoria, unidad_medida, stock_minimo) VALUES (2, 'Anestesia Lidocaína 2% con Epinefrina', 'Anestesia', 'Caja x 50', 10)");
              db.run("INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible) VALUES (2, 1, 'LOT-2025-B', '2026-08-15', 120.00, 50, 0)");

              db.run("INSERT INTO inventory_items (id, nombre, categoria, unidad_medida, stock_minimo) VALUES (3, 'Agujas Dentales Cortas (30G)', 'Consumibles', 'Caja x 100', 20)");
              db.run("INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible) VALUES (3, 1, 'LOT-2026-C', '2027-05-20', 35.00, 100, 65)");

              db.run("INSERT INTO inventory_items (id, nombre, categoria, unidad_medida, stock_minimo) VALUES (4, 'Guantes de Látex Talla M', 'Protección', 'Caja x 100', 15)");
              db.run("INSERT INTO inventory_batches (item_id, supplier_id, numero_lote, fecha_caducidad, costo_unitario, cantidad_inicial, cantidad_disponible) VALUES (4, 1, 'LOT-2026-D', '2026-10-10', 28.00, 50, 4)");
            });
          }
        });
      });
    });
  }
});


function initializeDatabase() {
  console.log('Inicializando la base de datos con el esquema...');
  try {
    const candidatePaths = [
      schemaPath,
      path.join(__dirname, '..', 'schema.sql'),
      path.join(process.resourcesPath || '', 'app.asar', 'schema.sql'),
      path.join(process.resourcesPath || '', 'schema.sql')
    ];
    let schemaSql = null;
    for (const p of candidatePaths) {
      if (p && fs.existsSync(p)) {
        schemaSql = fs.readFileSync(p, 'utf8');
        break;
      }
    }
    if (!schemaSql) {
      console.error('No se pudo encontrar el archivo schema.sql en las rutas esperadas.');
      return;
    }
    db.exec(schemaSql, (err) => {
      if (err) {
        console.error('Error al ejecutar el esquema de base de datos:', err.message);
      } else {
        if (process.env.NODE_ENV !== 'production' || process.env.SEED_DEFAULT_USERS === 'true') {
          db.exec(developmentUserSeeds, (seedErr) => {
            if (seedErr) {
              console.error('Error al crear los usuarios de desarrollo:', seedErr.message);
            }
          });
        }
        console.log('Esquema de base de datos creado con éxito.');
      }
    });
  } catch (err) {
    console.error('No se pudo leer el archivo schema.sql:', err.message);
  }
}

module.exports = db;
