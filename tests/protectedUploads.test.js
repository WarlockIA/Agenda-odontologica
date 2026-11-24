const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3');

test('uploaded files require an authenticated session', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const previousDbPath = process.env.DB_PATH;
  const secret = 'test-secret-for-protected-uploads';
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-uploads-'));
  const filePath = path.join(uploadDir, 'clinical-image.txt');
  fs.writeFileSync(filePath, 'private upload');

  process.env.DB_PATH = path.join(uploadDir, 'database.db');
  const initialDb = new sqlite3.Database(process.env.DB_PATH);
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  await new Promise((resolve, reject) => initialDb.exec(schema, (error) => error ? reject(error) : resolve()));
  await new Promise((resolve, reject) => initialDb.close((error) => error ? reject(error) : resolve()));
  const db = require('../src/db');
  const mountProtectedUploads = require('../src/middleware/protectedUploads');
  await new Promise((resolve, reject) => db.exec(
    "INSERT INTO users (id, email, password_hash, name, role) VALUES (1, 'test@example.com', 'unused', 'Test', 'odontologo');" +
    "INSERT INTO authorized_users (role, user_id, session_version) VALUES ('odontologo', 1, 'test-version');",
    (error) => error ? reject(error) : resolve()
  ));
  const app = express();
  app.use(cookieParser());
  mountProtectedUploads(app, uploadDir);
  const server = app.listen(0, '127.0.0.1');

  try {
    process.env.JWT_SECRET = secret;
    await new Promise((resolve) => server.once('listening', resolve));
    const url = `http://127.0.0.1:${server.address().port}/uploads/clinical-image.txt`;

    const unauthorized = await fetch(url);
    assert.equal(unauthorized.status, 401);

    const token = jwt.sign({ id: 1, sessionVersion: 'test-version' }, secret);
    const authorized = await fetch(url, { headers: { Cookie: `token=${token}` } });
    assert.equal(authorized.status, 200);
    assert.equal(await authorized.text(), 'private upload');
    assert.equal(authorized.headers.get('cache-control'), 'private, no-store');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await new Promise((resolve, reject) => db.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(uploadDir, { recursive: true, force: true });
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
    if (previousDbPath === undefined) delete process.env.DB_PATH;
    else process.env.DB_PATH = previousDbPath;
  }
});
