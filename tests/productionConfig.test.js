const test = require('node:test');
const assert = require('node:assert/strict');
const validateProductionConfig = require('../src/config/production');

test('production configuration is not required in development', () => {
  assert.doesNotThrow(() => validateProductionConfig({ NODE_ENV: 'development' }));
});

test('production requires a unique secret and a local reverse proxy', () => {
  const baseConfig = {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    TRUST_PROXY: 'loopback',
    HOST: '127.0.0.1'
  };

  assert.doesNotThrow(() => validateProductionConfig(baseConfig));
  assert.throws(() => validateProductionConfig({ ...baseConfig, JWT_SECRET: 'short' }), /JWT_SECRET/);
  assert.throws(() => validateProductionConfig({ ...baseConfig, TRUST_PROXY: '' }), /TRUST_PROXY/);
  assert.throws(() => validateProductionConfig({ ...baseConfig, HOST: '0.0.0.0' }), /HOST/);
});
