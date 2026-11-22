const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

// Ruta a la base de datos
const dbPath = path.join(__dirname, 'database.db');
const uploadsPath = path.join(__dirname, 'public', 'uploads');

console.log('--- INICIANDO LIMPIEZA DE HISTORIAL CLÍNICO ---');
console.log(`Conectando a la base de datos en: ${dbPath}`);

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error al conectar con la base de datos:', err.message);
        process.exit(1);
    }
});

db.serialize(() => {
    console.log('Ejecutando limpieza de tablas transaccionales...');

    // Iniciar transacción
    db.run('BEGIN TRANSACTION');

    try {
        // 1. Eliminar datos transaccionales (Historial clínico y citas)
        db.run('DELETE FROM patient_attachments;');
        db.run('DELETE FROM evolucion_tratamientos;');
        db.run('DELETE FROM appointment_treatments;');
        db.run('DELETE FROM appointments;');
        db.run('DELETE FROM patients;');

        // 2. Reiniciar los contadores de IDs (AUTOINCREMENT) a 0 para que los nuevos pacientes empiecen desde el ID 1
        db.run(`UPDATE sqlite_sequence SET seq = 0 WHERE name IN (
            'patients', 
            'appointments', 
            'appointment_treatments', 
            'evolucion_tratamientos', 
            'patient_attachments'
        );`);

        db.run('COMMIT', (err) => {
            if (err) throw err;
            console.log('✅ Base de datos limpiada con éxito. Pacientes y citas eliminados.');
            console.log('ℹ️  Se ha CONSERVADO toda la configuración: Usuarios, Horarios, Excepciones y Tratamientos.');

            // 3. Limpiar carpeta de uploads (radiografías, fotos, etc.)
            cleanUploadsFolder();

            // Cerrar base de datos
            db.close();
        });
    } catch (err) {
        db.run('ROLLBACK');
        console.error('❌ Error durante la limpieza, se deshicieron los cambios:', err.message);
        db.close();
    }
});

function cleanUploadsFolder() {
    console.log(`Verificando carpeta de archivos adjuntos en: ${uploadsPath}`);
    if (fs.existsSync(uploadsPath)) {
        const files = fs.readdirSync(uploadsPath);
        let deletedCount = 0;

        for (const file of files) {
            // Evitar borrar archivos de sistema o .gitkeep si existe
            if (file !== '.gitkeep' && file !== '.gitignore') {
                const filePath = path.join(uploadsPath, file);
                try {
                    fs.unlinkSync(filePath);
                    deletedCount++;
                } catch (err) {
                    console.error(`No se pudo eliminar el archivo ${file}:`, err.message);
                }
            }
        }
        console.log(`✅ Se eliminaron ${deletedCount} archivo(s) de la carpeta de uploads.`);
    } else {
        console.log('ℹ️ La carpeta de uploads no existe, no hay archivos por limpiar.');
    }
    console.log('--- LIMPIEZA FINALIZADA ---');
}
