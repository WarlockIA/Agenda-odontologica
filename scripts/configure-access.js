const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

function ask(question) {
  const prompt = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => prompt.question(question, (answer) => {
    prompt.close();
    resolve(answer.trim());
  }));
}

function askHidden(question) {
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Ejecute el comando en una terminal interactiva.'));
      return;
    }
    let answer = '';
    const onData = (chunk) => {
      for (const character of chunk.toString('utf8')) {
        if (character === '\u0003' || character === '\r' || character === '\n') {
          input.removeListener('data', onData);
          input.setRawMode(false);
          input.pause();
          process.stdout.write('\n');
          if (character === '\u0003') reject(new Error('Configuración cancelada.'));
          else resolve(answer);
          return;
        }
        if (character === '\u007f' || character === '\b') answer = answer.slice(0, -1);
        else answer += character;
      }
    };
    process.stdout.write(question);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve(this.lastID);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (error, row) => error ? reject(error) : resolve(row));
  });
}

async function configureAccess(db, accounts) {
  if (accounts.length !== 2 ||
      accounts[0].role !== 'odontologo' || accounts[1].role !== 'recepcionista') {
    throw new Error('Se requieren un odontólogo y un asistente.');
  }
  const normalized = accounts.map((account) => ({
    ...account,
    name: account.name.trim(),
    email: account.email.trim().toLowerCase()
  }));
  for (const account of normalized) {
    if (account.name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(account.email)) {
      throw new Error('Ingrese un nombre y correo válidos para cada cuenta.');
    }
    if (account.password.length < 12 || Buffer.byteLength(account.password, 'utf8') > 72) {
      throw new Error('Cada contraseña debe tener al menos 12 caracteres y no superar 72 bytes UTF-8.');
    }
  }
  if (normalized[0].email === normalized[1].email) {
    throw new Error('Las cuentas deben tener correos distintos.');
  }
  if (normalized[0].password === normalized[1].password) {
    throw new Error('Las cuentas deben tener contraseñas distintas.');
  }

  const hashes = await Promise.all(normalized.map((account) => bcrypt.hash(account.password, 12)));
  await run(db, 'BEGIN IMMEDIATE');
  try {
    await run(db, 'DELETE FROM authorized_users');
    for (let i = 0; i < normalized.length; i++) {
      const account = normalized[i];
      const existing = await get(db, 'SELECT id FROM users WHERE email = ?', [account.email]);
      let userId;
      if (existing) {
        userId = existing.id;
        await run(db, 'UPDATE users SET name = ?, password_hash = ?, role = ? WHERE id = ?',
          [account.name, hashes[i], account.role, userId]);
      } else {
        userId = await run(db, 'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
          [account.name, account.email, hashes[i], account.role]);
      }
      await run(db, 'INSERT INTO authorized_users (role, user_id, session_version) VALUES (?, ?, ?)',
        [account.role, userId, crypto.randomBytes(32).toString('hex')]);
    }
    await run(db, 'COMMIT');
  } catch (error) {
    await run(db, 'ROLLBACK');
    throw error;
  }
}

async function main() {
  const databasePath = process.env.DB_PATH;
  if (!databasePath || !path.isAbsolute(databasePath) || !fs.existsSync(databasePath)) {
    throw new Error('DB_PATH debe ser la ruta absoluta de una base de datos existente.');
  }
  const accounts = [];
  for (const [label, role] of [['odontólogo', 'odontologo'], ['asistente', 'recepcionista']]) {
    console.log(`\nCuenta del ${label}:`);
    const name = await ask('Nombre: ');
    const email = await ask('Correo: ');
    const password = await askHidden('Contraseña (mínimo 12 caracteres): ');
    const confirmation = await askHidden('Confirmar contraseña: ');
    if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
    accounts.push({ name, email, password, role });
  }
  const db = await new Promise((resolve, reject) => {
    const connection = new sqlite3.Database(databasePath, sqlite3.OPEN_READWRITE, (error) => {
      if (error) reject(error);
      else resolve(connection);
    });
  });
  try {
    await configureAccess(db, accounts);
    console.log('Acceso configurado para las dos cuentas. Las sesiones anteriores han sido invalidadas.');
  } finally {
    await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error('No se pudo configurar el acceso:', error.message);
    process.exitCode = 1;
  });
}

module.exports = { configureAccess };
