'use strict';

exports.default = async function (configuration) {
  console.log(`[CustomSign] Omitiendo firma para: ${configuration.path}`);
  return true;
};

if (require.main === module) {
  process.exit(0);
}
