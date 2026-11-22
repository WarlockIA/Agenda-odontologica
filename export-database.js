const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database.db');
const exportDir = path.join(__dirname, 'exportacion_bd');
const csvDir = path.join(exportDir, 'csv');

if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir, { recursive: true });
}
if (!fs.existsSync(csvDir)) {
  fs.mkdirSync(csvDir, { recursive: true });
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error al conectar a la base de datos:', err);
    process.exit(1);
  }
});

function queryAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function escapeCsvField(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

function rowsToCsv(rows) {
  if (!rows || rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const headerRow = headers.map(escapeCsvField).join(',');
  const dataRows = rows.map(row => {
    return headers.map(h => escapeCsvField(row[h])).join(',');
  });
  return [headerRow, ...dataRows].join('\n');
}

async function exportDatabase() {
  console.log('===================================================');
  console.log(' EXPORTANDO BASE DE DATOS PARA CIENCIA DE DATOS');
  console.log('===================================================');

  // Obtener lista de tablas
  const tablesResult = await queryAll("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';");
  const tables = tablesResult.map(t => t.name);

  const fullData = {};
  let sqlDump = `-- VOLCADO COMPLETO DE LA BASE DE DATOS DE AGENDA ODONTOLÓGICA\n-- Fecha de exportación: ${new Date().toISOString()}\n\n`;

  for (const table of tables) {
    const rows = await queryAll(`SELECT * FROM ${table}`);
    fullData[table] = rows;

    // Guardar CSV
    const csvContent = rowsToCsv(rows);
    const csvFilePath = path.join(csvDir, `${table}.csv`);
    fs.writeFileSync(csvFilePath, csvContent, 'utf8');
    console.log(`✅ Exportada tabla '${table}' -> CSV (${rows.length} registros)`);

    // Construir SQL INSERT statements para el dump
    if (rows.length > 0) {
      const cols = Object.keys(rows[0]).join(', ');
      sqlDump += `-- Tabla: ${table}\n`;
      rows.forEach(r => {
        const vals = Object.values(r).map(v => {
          if (v === null || v === undefined) return 'NULL';
          if (typeof v === 'number') return v;
          return `'${String(v).replace(/'/g, "''")}'`;
        }).join(', ');
        sqlDump += `INSERT INTO ${table} (${cols}) VALUES (${vals});\n`;
      });
      sqlDump += `\n`;
    }
  }

  // Guardar JSON completo
  const jsonPath = path.join(exportDir, 'agenda_odontologica_export.json');
  fs.writeFileSync(jsonPath, JSON.stringify(fullData, null, 2), 'utf8');
  console.log(`✅ Archivo JSON completo generado -> ${jsonPath}`);

  // Guardar SQL dump
  const sqlPath = path.join(exportDir, 'agenda_odontologica_dump.sql');
  fs.writeFileSync(sqlPath, sqlDump, 'utf8');
  console.log(`✅ Archivo SQL Dump generado -> ${sqlPath}`);

  console.log('===================================================');
  console.log(' EXPORTACIÓN FINALIZADA CON ÉXITO EN exportacion_bd/');
  console.log('===================================================');

  db.close();
}

exportDatabase().catch(err => {
  console.error('Error al exportar base de datos:', err);
  db.close();
});
