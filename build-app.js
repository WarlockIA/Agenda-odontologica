const { execSync } = require('child_process');
const fs = require('fs');

async function build() {
  for (let attempt = 1; attempt <= 3; attempt++) {
    console.log(`Building Electron app (Attempt ${attempt}/3)...`);
    try {
      try {
        execSync('taskkill /F /FI "IMAGENAME eq Agenda*" /T', { stdio: 'ignore' });
        execSync('taskkill /F /IM "electron.exe" /T', { stdio: 'ignore' });
      } catch (e) {}
      try {
        fs.rmSync('dist', { recursive: true, force: true });
      } catch (e) {}

      execSync('npx electron-builder', { stdio: 'inherit' });
      console.log('ELECTRON_BUILD_SUCCESS');
      return;
    } catch (err) {
      console.warn(`Attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) {
        console.log('Waiting 5 seconds before retrying...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      } else {
        process.exit(1);
      }
    }
  }
}

build();
