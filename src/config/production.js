const DEFAULT_JWT_SECRET = 'super_secret_secure_key_1234567890_agenda_odontologica';

function validateProductionConfig(env = process.env) {
  if (env.NODE_ENV !== 'production') return;

  if (!env.JWT_SECRET || env.JWT_SECRET.length < 64 || env.JWT_SECRET === DEFAULT_JWT_SECRET) {
    throw new Error('Production requires a unique JWT_SECRET of at least 64 characters.');
  }

  if (env.TRUST_PROXY !== 'loopback') {
    throw new Error('Production requires TRUST_PROXY=loopback for the local Nginx proxy.');
  }

  if (env.HOST && env.HOST !== '127.0.0.1') {
    throw new Error('Production must bind HOST to 127.0.0.1 behind Nginx.');
  }
}

module.exports = validateProductionConfig;
