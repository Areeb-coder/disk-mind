const fs = require('fs');
const path = require('path');

const appDataPath = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || '', 'AppData', 'Local');
const tokenPath = path.join(appDataPath, 'DiskMind', 'client_token.txt');
const configPath = path.join(__dirname, '..', 'public', 'config.json');

try {
  if (fs.existsSync(tokenPath)) {
    const token = fs.readFileSync(tokenPath, 'utf8').trim();
    const config = { port: 5000, token };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    console.log('[DiskMind] Config written successfully.');
  } else {
    console.warn('[DiskMind] Token file not found at:', tokenPath);
    const config = { port: 5000, token: '' };
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }
} catch (err) {
  console.error('[DiskMind] Failed to write config:', err);
}
