const Jimp = require('jimp-compact');
const path = require('path');

async function generateAssets() {
  const assetsDir = path.join(__dirname, 'assets');

  const icon = await Jimp.create(1024, 1024, 0x0f172aff);
  const splash = await Jimp.create(1242, 2436, 0x000000ff);
  const adaptive = await Jimp.create(1024, 1024, 0x059669ff);
  const favicon = await Jimp.create(64, 64, 0x0f172aff);

  await icon.writeAsync(path.join(assetsDir, 'icon.png'));
  await splash.writeAsync(path.join(assetsDir, 'splash.png'));
  await adaptive.writeAsync(path.join(assetsDir, 'adaptive-icon.png'));
  await favicon.writeAsync(path.join(assetsDir, 'favicon.png'));

  console.log('✓ 100% Native Jimp PNG assets written successfully!');
}

generateAssets().catch(err => {
  console.error('Error generating assets:', err);
  process.exit(1);
});
