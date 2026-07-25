const fs = require('fs');
const path = require('path');

const sourcePath = '/Users/geomanuk/.gemini/antigravity-ide/brain/5b34d69a-d858-436b-b21c-b3c9ce4201b6/app_icon_padded_void_1784976157674.png';
const assetsDir = path.join(__dirname, 'assets');

if (!fs.existsSync(sourcePath)) {
  console.error(`Source image not found at: ${sourcePath}`);
  process.exit(1);
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

['icon.png', 'splash.png', 'adaptive-icon.png', 'favicon.png'].forEach(file => {
  fs.copyFileSync(sourcePath, path.join(assetsDir, file));
});

console.log('App icons and assets successfully updated using the VOID logo!');
