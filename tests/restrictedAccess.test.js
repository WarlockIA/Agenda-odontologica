const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const sqlite3 = require('sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { configureAccess } = require('../scripts/configure-access');

test('only the configured two accounts can log in and old sessions are revoked', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-access-'));
  process.env.DB_PATH = path.join(dir, 'database.db');
  process.env.UPLOAD_PATH = path.join(dir, 'uploads');
  process.env.JWT_SECRET = 'test-secret-for-restricted-access';
  process.env.NODE_ENV = 'production';

  const initialDb = new sqlite3.Database(process.env.DB_PATH);
  const schema = fs.readFileSync(path.join(__dirname, '../schema.sql'), 'utf8');
  await new Promise((resolve, reject) => initialDb.exec(schema, (err) => err ? reject(err) : resolve()));
  await new Promise((resolve, reject) => initialDb.close((err) => err ? reject(err) : resolve()));

  const app = require('../src/server');
  const db = require('../src/db');
  const run = (sql, params = []) => new Promise((resolve, reject) => {
    db.run(sql, params, (err) => err ? reject(err) : resolve());
  });
  const get = (sql, params = []) => new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => err ? reject(err) : resolve(row));
  });
  const accounts = [
    { role: 'odontologo', name: 'Odontologo', email: 'doctor@example.test', password: 'dentist-password-1' },
    { role: 'recepcionista', name: 'Asistente', email: 'assistant@example.test', password: 'assistant-password-2' }
  ];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const login = (email, password) => fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  try {
    await run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      ['Anterior', 'old@example.test', await bcrypt.hash('previous-password', 12), 'odontologo']);
    await configureAccess(db, accounts);
    assert.equal((await login('old@example.test', 'previous-password')).status, 401);
    assert.equal((await login(accounts[0].email, 'incorrect')).status, 401);

    const doctor = await login(accounts[0].email, accounts[0].password);
    assert.equal(doctor.status, 200);
    const cookie = doctor.headers.get('set-cookie').split(';')[0];
    assert.equal((await login(accounts[1].email, accounts[1].password)).status, 200);
    assert.equal((await fetch(`${base}/api/auth/verify`, { headers: { Cookie: cookie } })).status, 200);
    const doctorId = (await get('SELECT id FROM users WHERE email = ?', [accounts[0].email])).id;
    const oldToken = jwt.sign({ id: doctorId, role: 'odontologo' }, process.env.JWT_SECRET);
    assert.equal((await fetch(`${base}/api/auth/verify`, {
      headers: { Cookie: `token=${oldToken}` }
    })).status, 401);
    assert.equal((await fetch(`${base}/api/auth/register`, { method: 'POST' })).status, 404);
    assert.equal((await fetch(`${base}/api/auth/register`, {
      method: 'POST', headers: { Cookie: cookie }
    })).status, 404);

    await assert.rejects(configureAccess(db, [accounts[0], { ...accounts[1], email: accounts[0].email }]), /distintos/);
    assert.equal((await fetch(`${base}/api/auth/verify`, { headers: { Cookie: cookie } })).status, 200);

    await run(`CREATE TRIGGER reject_assistant BEFORE INSERT ON authorized_users
      WHEN NEW.role = 'recepcionista' BEGIN SELECT RAISE(ABORT, 'test failure'); END`);
    await assert.rejects(configureAccess(db, accounts), /test failure/);
    await run('DROP TRIGGER reject_assistant');
    assert.equal((await fetch(`${base}/api/auth/verify`, { headers: { Cookie: cookie } })).status, 200);
    assert.equal((await login(accounts[1].email, accounts[1].password)).status, 200);

    const replacement = { ...accounts[1], email: 'new-assistant@example.test' };
    await configureAccess(db, [accounts[0], replacement]);
    assert.equal((await fetch(`${base}/api/auth/verify`, { headers: { Cookie: cookie } })).status, 401);
    assert.equal((await login(accounts[1].email, accounts[1].password)).status, 401);
    assert.equal((await login(replacement.email, replacement.password)).status, 200);
    assert.ok(await get('SELECT id FROM users WHERE email = ?', [accounts[1].email]));
  } finally {
    await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
    await new Promise((resolve, reject) => db.close((err) => err ? reject(err) : resolve()));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
