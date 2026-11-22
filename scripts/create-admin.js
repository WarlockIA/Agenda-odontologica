const bcrypt = require('bcryptjs');
const readline = require('readline');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const configuredPath = process.env.DB_PATH;

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
    const output = process.stdout;
    if (!input.isTTY || typeof input.setRawMode !== 'function') {
      reject(new Error('Run this command from an interactive terminal so the password is not exposed.'));
      return;
    }

    let answer = '';
    const finish = (error) => {
      input.removeListener('data', onData);
      input.setRawMode(false);
      input.pause();
      output.write('\n');
      if (error) reject(error);
      else resolve(answer);
    };
    const onData = (chunk) => {
      const character = chunk.toString('utf8');
      if (character === '\u0003') {
        finish(new Error('Admin creation cancelled.'));
      } else if (character === '\r' || character === '\n') {
        finish();
      } else if (character === '\u007f' || character === '\b') {
        answer = answer.slice(0, -1);
      } else {
        answer += character;
      }
    };

    output.write(question);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });
}

function openDatabase(databasePath) {
  return new Promise((resolve, reject) => {
    const database = new sqlite3.Database(databasePath, (error) => {
      if (error) reject(error);
      else resolve(database);
    });
  });
}

function get(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.get(sql, params, (error, row) => {
      if (error) reject(error);
      else resolve(row);
    });
  });
}

function run(database, sql, params = []) {
  return new Promise((resolve, reject) => {
    database.run(sql, params, function(error) {
      if (error) reject(error);
      else resolve(this.lastID);
    });
  });
}

function close(database) {
  return new Promise((resolve, reject) => {
    database.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function main() {
  if (!configuredPath || !path.isAbsolute(configuredPath)) {
    throw new Error('Set DB_PATH to the absolute path of the production database.');
  }

  const databasePath = path.resolve(configuredPath);
  if (!fs.existsSync(databasePath)) {
    throw new Error('The database does not exist yet. Start the production service once, then stop it and retry.');
  }

  const name = await ask('Administrator name: ');
  const email = (await ask('Administrator email: ')).toLowerCase();
  const password = await askHidden('Password (minimum 12 characters): ');
  const confirmation = await askHidden('Confirm password: ');

  if (name.length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Enter a valid name and email address.');
  }
  if (password.length < 12 || password !== confirmation) {
    throw new Error('Passwords must match and contain at least 12 characters.');
  }

  const database = await openDatabase(databasePath);
  try {
    const row = await get(database, 'SELECT COUNT(*) AS count FROM users');
    if (row.count !== 0) {
      throw new Error('Admin bootstrap is only allowed when the users table is empty.');
    }

    const passwordHash = await bcrypt.hash(password, await bcrypt.genSalt(12));
    await run(
      database,
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'odontologo']
    );
    console.log('Initial odontologist account created.');
  } finally {
    await close(database);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
