-- Schema para la base de datos de Agenda Odontológica (SQLite)

-- Tabla de Usuarios
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL, -- 'odontologo' o 'recepcionista'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Crear índice para búsquedas rápidas por correo (y asegurar unicidad)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Solo una cuenta autorizada por rol.
CREATE TABLE IF NOT EXISTS authorized_users (
    role TEXT PRIMARY KEY CHECK(role IN ('odontologo', 'recepcionista')),
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
    session_version TEXT NOT NULL
);

-- Tabla de Citas (Appointments)
-- HU-001: Registro Digital de Citas
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_name TEXT NOT NULL,
    patient_phone TEXT,                        -- Teléfono (opcional)
    treatment TEXT NOT NULL,
    appointment_date TEXT NOT NULL,            -- Formato: YYYY-MM-DD
    appointment_time TEXT NOT NULL,            -- Formato: HH:MM
    status TEXT NOT NULL DEFAULT 'Programada', -- HU-001: estado inicial siempre 'Programada'
    created_by INTEGER NOT NULL,
    patient_id INTEGER,                        -- Vínculo a ficha de paciente (HU-009)
    observaciones_clinicas TEXT,               -- Observaciones clínicas (HU-011)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id),
    FOREIGN KEY(patient_id) REFERENCES patients(id)
);

-- Índice para detección eficiente de conflictos de horario (HU-001)
CREATE INDEX IF NOT EXISTS idx_appointments_datetime
    ON appointments(appointment_date, appointment_time);

-- Tabla de Configuración (Settings) para la clínica
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL -- Guardado como JSON string
);

-- Insertar configuración por defecto del horario de atención (HU-003)
-- Estructura con ventanas de tiempo MÚLTIPLES para máxima flexibilidad.
-- timeWindows permite definir n bloques horarios independientes (mañana, tarde, etc.).
-- Para agregar atención el sábado por la mañana en el futuro, solo se hace:
--   UPDATE settings SET value = '{..."workDays":[1,2,3,4,5,6],...}' WHERE key = 'clinic_hours';
INSERT OR IGNORE INTO settings (key, value)
VALUES (
    'clinic_hours',
    '{"workDays":[1,2,3,4,5,6],"timeWindows":[{"start":"08:00","end":"12:00"},{"start":"14:00","end":"18:00"}]}'
);

-- Insertar configuración por defecto del sistema
INSERT OR IGNORE INTO settings (key, value)
VALUES (
    'system_config',
    '{"cronTime":"08:00","countryCode":"+591"}'
);

-- Tabla de Pacientes (Fichas Clínicas - HU-008)
CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ficha_nro INTEGER UNIQUE,
    nombre_completo TEXT NOT NULL,
    profesion_ocupacion TEXT,
    fecha_nacimiento TEXT,
    edad INTEGER,
    domicilio TEXT,
    sexo TEXT,
    ciudad_localidad TEXT,
    telefono TEXT,
    ci TEXT UNIQUE NOT NULL,
    examen_extraoral TEXT,
    diagnostico_presuntivo TEXT,
    notas_medicas TEXT,
    creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Índice único para asegurar rapidez de búsqueda por CI y unicidad nativa
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_ci ON patients(ci);

-- Índice adicional en nombre_completo insensible a mayúsculas/minúsculas para agilizar búsquedas del autocompletado
CREATE INDEX IF NOT EXISTS idx_patients_nombre_nocase ON patients(nombre_completo COLLATE NOCASE);

-- Tabla de Tratamientos / Servicios (HU-010)
CREATE TABLE IF NOT EXISTS treatments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT UNIQUE NOT NULL,
    costo_base REAL NOT NULL,
    activo INTEGER DEFAULT 1, -- 1 = Activo, 0 = Inactivo
    color TEXT DEFAULT '#3b82f6',
    categoria TEXT DEFAULT 'General',
    eliminado INTEGER DEFAULT 0 -- 0 = No eliminado, 1 = Eliminado lógicamente
);

-- Insertar tratamientos semilla de prueba
INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Limpieza Dental', 50.0, 1);
INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Extracción Simple', 80.0, 1);
INSERT OR IGNORE INTO treatments (nombre, costo_base, activo) VALUES ('Endodoncia Unirradicular', 250.0, 1);

-- Tabla intermedia Cita_Tratamiento (HU-011)
CREATE TABLE IF NOT EXISTS appointment_treatments (
    appointment_id INTEGER NOT NULL,
    treatment_id INTEGER NOT NULL,
    costo_aplicado REAL NOT NULL,
    PRIMARY KEY (appointment_id, treatment_id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id) ON DELETE CASCADE,
    FOREIGN KEY (treatment_id) REFERENCES treatments(id)
);

-- Tabla de Horarios de Atención por Día de la Semana (HU-003)
CREATE TABLE IF NOT EXISTS working_hours (
    day_of_week INTEGER PRIMARY KEY, -- 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
    activo INTEGER DEFAULT 1,        -- 1 = Abierto, 0 = Cerrado
    mañana_inicio TEXT,              -- "08:00"
    mañana_fin TEXT,                 -- "12:00"
    tarde_inicio TEXT,               -- "14:00"
    tarde_fin TEXT                   -- "18:00"
);

-- Poblar con horario por defecto comercial (Lunes a Viernes abierto, Sábado y Domingo cerrado)
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (0, 0, NULL, NULL, NULL, NULL);
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (1, 1, '08:00', '12:00', '14:00', '18:00');
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (2, 1, '08:00', '12:00', '14:00', '18:00');
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (3, 1, '08:00', '12:00', '14:00', '18:00');
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (4, 1, '08:00', '12:00', '14:00', '18:00');
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (5, 1, '08:00', '12:00', '14:00', '18:00');
INSERT OR IGNORE INTO working_hours (day_of_week, activo, mañana_inicio, mañana_fin, tarde_inicio, tarde_fin) VALUES (6, 1, '08:00', '12:00', '14:00', '18:00');

-- Tabla de Evolución y Control de Tratamientos
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
);

CREATE INDEX IF NOT EXISTS idx_evolucion_paciente ON evolucion_tratamientos(paciente_id);

-- Tabla de Archivos Adjuntos de Pacientes
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
);

CREATE INDEX IF NOT EXISTS idx_attachments_paciente ON patient_attachments(paciente_id);

-- Tabla de Feriados y Excepciones de Horario
CREATE TABLE IF NOT EXISTS clinic_exceptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    exception_date TEXT UNIQUE NOT NULL, -- Formato: YYYY-MM-DD
    description TEXT NOT NULL,
    is_recurring INTEGER DEFAULT 0, -- 0: Único, 1: Anual (se repite cada año)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exceptions_date ON clinic_exceptions(exception_date);



-- TABLAS DEL MÓDULO DE INVENTARIO CENTRALIZADO --

CREATE TABLE IF NOT EXISTS inventory_suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre_empresa TEXT NOT NULL,
    telefono TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL,
    categoria TEXT,
    unidad_medida TEXT,
    stock_minimo INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER NOT NULL,
    supplier_id INTEGER,
    numero_lote TEXT,
    fecha_caducidad TEXT, -- YYYY-MM-DD
    costo_unitario REAL DEFAULT 0.00,
    cantidad_inicial INTEGER NOT NULL,
    cantidad_disponible INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY(supplier_id) REFERENCES inventory_suppliers(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_batches_item ON inventory_batches(item_id);

CREATE TABLE IF NOT EXISTS inventory_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_id INTEGER NOT NULL,
    tipo TEXT NOT NULL, -- 'ENTRADA', 'SALIDA', 'AJUSTE'
    cantidad INTEGER NOT NULL,
    motivo TEXT,
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(batch_id) REFERENCES inventory_batches(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_transactions_batch ON inventory_transactions(batch_id);

CREATE TABLE IF NOT EXISTS treatment_materials (
    treatment_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    cantidad_requerida INTEGER NOT NULL DEFAULT 1,
    PRIMARY KEY (treatment_id, item_id),
    FOREIGN KEY(treatment_id) REFERENCES treatments(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS appointment_consumables (
    evolucion_id INTEGER NOT NULL,
    item_id INTEGER NOT NULL,
    cantidad_usada INTEGER NOT NULL,
    PRIMARY KEY (evolucion_id, item_id),
    FOREIGN KEY(evolucion_id) REFERENCES evolucion_tratamientos(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
);
