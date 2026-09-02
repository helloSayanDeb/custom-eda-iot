const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function fetchLatestBundle() {
  console.log('Fetching latest release info...');
  const res = await fetch('https://api.github.com/repos/adafruit/Adafruit_CircuitPython_Bundle/releases/latest');
  const json = await res.json();
  const pyBundle = json.assets.find(a => a.name.includes('-py-'));
  if (!pyBundle) throw new Error('No .py bundle found');
  
  console.log('Downloading ' + pyBundle.browser_download_url);
  execSync('curl -L -o bundle.zip ' + pyBundle.browser_download_url);
  
  console.log('Unzipping...');
  execSync('tar -xf bundle.zip');
  
  // Find extracted folder
  const folders = fs.readdirSync('.').filter(f => f.startsWith('adafruit-circuitpython-bundle-py-') && fs.statSync(f).isDirectory());
  const libDir = path.join(folders[0], 'lib');
  
  const dest = 'public/lib';
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  
  const libsToCopy = [
    'adafruit_bus_device',
    'adafruit_register',
    'adafruit_mpu6050.py',
    'adafruit_tmp117.py',
    'adafruit_max30102',
    'adafruit_ens160.py',
    'adafruit_ahtx0.py',
    'adafruit_ltr390.py'
  ];
  
  for (const lib of libsToCopy) {
    const srcPath = path.join(libDir, lib);
    const destPath = path.join(dest, lib);
    
    if (fs.existsSync(srcPath)) {
      fs.cpSync(srcPath, destPath, { recursive: true });
      console.log('Copied ' + lib);
    } else {
      console.log('WARNING: Not found ' + lib);
    }
  }
  
  // Cleanup
  fs.rmSync('bundle.zip', { force: true });
  fs.rmSync(folders[0], { recursive: true, force: true });
  console.log('Done!');
}

fetchLatestBundle().catch(console.error);
