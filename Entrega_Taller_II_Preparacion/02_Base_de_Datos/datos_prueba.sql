-- Datos ficticios para usar únicamente después de aplicar schema.sql.
-- No contiene usuarios ni contraseñas.
BEGIN TRANSACTION;
INSERT OR IGNORE INTO patients (nombre_completo, ci, edad, sexo)
VALUES ('Paciente de Prueba Uno', 'TEST-001', 30, 'F');
INSERT OR IGNORE INTO patients (nombre_completo, ci, edad, sexo)
VALUES ('Paciente de Prueba Dos', 'TEST-002', 40, 'M');
INSERT OR IGNORE INTO treatments (nombre, costo_base, categoria)
VALUES ('Tratamiento de prueba', 100, 'General');
COMMIT;
