const fs = require('fs');
const path = require('path');

// Valid 1x1 PNG pixel buffer (base64 decoded)
const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const pngBuffer = Buffer.from(pngBase64, 'base64');

const assetsDir = path.join(__dirname, 'assets');

['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'].forEach(file => {
  fs.writeFileSync(path.join(assetsDir, file), pngBuffer);
});

console.log('Fixed assets with valid PNG binary buffers.');
