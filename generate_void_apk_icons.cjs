const Jimp = require('./mobile/node_modules/jimp-compact');
const path = require('path');
const fs = require('fs');

async function generateVoidIcons() {
  const logoPath = path.join(__dirname, 'src', 'assets', '60ace96c513e5568730553.png');
  const mobileAssetsDir = path.join(__dirname, 'mobile', 'assets');
  
  console.log('Loading VOID logo from:', logoPath);
  const logo = await Jimp.read(logoPath);

  // 1. Create master App Icon (1024x1024)
  const iconSize = 1024;
  const masterIcon = await Jimp.create(iconSize, iconSize, 0x000000ff);
  
  // Scale logo to 72% of width
  const logoWidth = 740;
  const logoHeight = Math.round((logo.bitmap.height / logo.bitmap.width) * logoWidth);
  const scaledLogo = logo.clone().resize(logoWidth, logoHeight);
  
  const logoX = Math.round((iconSize - logoWidth) / 2);
  const logoY = Math.round((iconSize - logoHeight) / 2);
  masterIcon.composite(scaledLogo, logoX, logoY);

  // 2. Create master Adaptive Foreground Icon (1024x1024 with safe zone centering)
  const masterForeground = await Jimp.create(iconSize, iconSize, 0x00000000); // transparent background for adaptive foreground
  const safeLogoWidth = 560; // safe zone is inner 66%
  const safeLogoHeight = Math.round((logo.bitmap.height / logo.bitmap.width) * safeLogoWidth);
  const safeScaledLogo = logo.clone().resize(safeLogoWidth, safeLogoHeight);
  
  const safeX = Math.round((iconSize - safeLogoWidth) / 2);
  const safeY = Math.round((iconSize - safeLogoHeight) / 2);
  masterForeground.composite(safeScaledLogo, safeX, safeY);

  // Also create a version on solid black for fallback adaptive
  const masterAdaptiveSolid = await Jimp.create(iconSize, iconSize, 0x000000ff);
  masterAdaptiveSolid.composite(safeScaledLogo, safeX, safeY);

  // 3. Create Splash screen (1242x2436)
  const splashWidth = 1242;
  const splashHeight = 2436;
  const masterSplash = await Jimp.create(splashWidth, splashHeight, 0x000000ff);
  const splashLogoWidth = 680;
  const splashLogoHeight = Math.round((logo.bitmap.height / logo.bitmap.width) * splashLogoWidth);
  const splashScaledLogo = logo.clone().resize(splashLogoWidth, splashLogoHeight);
  const splashX = Math.round((splashWidth - splashLogoWidth) / 2);
  const splashY = Math.round((splashHeight - splashLogoHeight) / 2);
  masterSplash.composite(splashScaledLogo, splashX, splashY);

  // Save to mobile/assets/
  await masterIcon.writeAsync(path.join(mobileAssetsDir, 'icon.png'));
  await masterAdaptiveSolid.writeAsync(path.join(mobileAssetsDir, 'adaptive-icon.png'));
  await masterSplash.writeAsync(path.join(mobileAssetsDir, 'splash.png'));
  const favicon = masterIcon.clone().resize(64, 64);
  await favicon.writeAsync(path.join(mobileAssetsDir, 'favicon.png'));

  console.log('✓ mobile/assets icons generated successfully!');

  // Densities map for Android mipmaps
  const densities = [
    { name: 'mipmap-mdpi', iconSize: 48, fgSize: 108 },
    { name: 'mipmap-hdpi', iconSize: 72, fgSize: 162 },
    { name: 'mipmap-xhdpi', iconSize: 96, fgSize: 216 },
    { name: 'mipmap-xxhdpi', iconSize: 144, fgSize: 324 },
    { name: 'mipmap-xxxhdpi', iconSize: 192, fgSize: 432 },
  ];

  const resDirs = [
    path.join(__dirname, 'mobile', 'android', 'app', 'src', 'main', 'res'),
    path.join(__dirname, 'android', 'app', 'src', 'main', 'res'),
  ];

  for (const resDir of resDirs) {
    if (!fs.existsSync(resDir)) continue;

    for (const d of densities) {
      const dirPath = path.join(resDir, d.name);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Generate ic_launcher and ic_launcher_round
      const iconResized = masterIcon.clone().resize(d.iconSize, d.iconSize);
      await iconResized.writeAsync(path.join(dirPath, 'ic_launcher.png'));
      await iconResized.writeAsync(path.join(dirPath, 'ic_launcher_round.png'));

      // If webp exists or was used, write webp too
      await iconResized.writeAsync(path.join(dirPath, 'ic_launcher.webp'));
      await iconResized.writeAsync(path.join(dirPath, 'ic_launcher_round.webp'));

      // Generate ic_launcher_foreground
      const fgResized = masterForeground.clone().resize(d.fgSize, d.fgSize);
      await fgResized.writeAsync(path.join(dirPath, 'ic_launcher_foreground.png'));
      await fgResized.writeAsync(path.join(dirPath, 'ic_launcher_foreground.webp'));

      console.log(`✓ Updated ${d.name} in ${path.relative(__dirname, resDir)}`);
    }
  }

  console.log('🎉 ALL VOID LOGO APK ICONS GENERATED & SYNCED SUCCESSFULLY!');
}

generateVoidIcons().catch(err => {
  console.error('Failed to generate VOID icons:', err);
  process.exit(1);
});
