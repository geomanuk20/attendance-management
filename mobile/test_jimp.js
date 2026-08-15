const Jimp = require('jimp-compact');
const path = require('path');

const files = ['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'];

async function test() {
  for (const f of files) {
    const fullPath = path.join(__dirname, 'assets', f);
    try {
      await Jimp.read(fullPath);
      console.log(`✓ ${f} is VALID Jimp image`);
    } catch (err) {
      console.error(`❌ ${f} FAILED Jimp:`, err.message);
    }
  }
}

test();
