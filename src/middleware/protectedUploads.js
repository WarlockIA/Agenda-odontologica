const fs = require('fs');
const path = require('path');
const express = require('express');
const { verifyToken } = require('./auth');

function mountProtectedUploads(app, directory) {
  const uploadDir = path.resolve(directory);
  fs.mkdirSync(uploadDir, { recursive: true });

  app.use(
    '/uploads',
    verifyToken,
    express.static(uploadDir, {
      setHeaders: (res) => res.setHeader('Cache-Control', 'private, no-store')
    })
  );
}

module.exports = mountProtectedUploads;
