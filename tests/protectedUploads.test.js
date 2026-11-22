const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const mountProtectedUploads = require('../src/middleware/protectedUploads');

test('uploaded files require an authenticated session', async () => {
  const previousSecret = process.env.JWT_SECRET;
  const secret = 'test-secret-for-protected-uploads';
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'agenda-uploads-'));
  const filePath = path.join(uploadDir, 'clinical-image.txt');
  fs.writeFileSync(filePath, 'private upload');

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

    const token = jwt.sign({ id: 1, role: 'odontologo' }, secret);
    const authorized = await fetch(url, { headers: { Cookie: `token=${token}` } });
    assert.equal(authorized.status, 200);
    assert.equal(await authorized.text(), 'private upload');
    assert.equal(authorized.headers.get('cache-control'), 'private, no-store');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    fs.rmSync(uploadDir, { recursive: true, force: true });
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
