import {
  BOARD_MOCK, BUSIO_MOCK, DIGITALIO_MOCK, ANALOGIO_MOCK,
  SUPERVISOR_MOCK, MICROCONTROLLER_MOCK, TIME_MOCK,
  MICROPYTHON_MOCK, CIRCUITPYTHON_TYPING_MOCK,
  ADAFRUIT_BLE_INIT_MOCK, ADAFRUIT_BLE_ADV_INIT_MOCK,
  ADAFRUIT_BLE_ADV_STANDARD_MOCK, ADAFRUIT_BLE_SERVICES_INIT_MOCK,
  ADAFRUIT_BLE_SERVICES_NORDIC_MOCK,
  ADAFRUIT_MPU6050_MOCK, ADAFRUIT_TMP117_MOCK,
} from './python_mocks';
import { i2cBus } from './mocks/MockI2CBus';
import { MockTMP117 } from './mocks/MockTMP117';
import { MockMPU6050 } from './mocks/MockMPU6050';
import { MockMAX30102 } from './mocks/MockMAX30102';
import { MockENS160 } from './mocks/MockENS160';
import { MockAHT21 } from './mocks/MockAHT21';
import { MockLTR390 } from './mocks/MockLTR390';

let pyodide: any = null;

// ── Register your exact hardware on the mock I2C bus ─────────────
// From your block diagram:
//   MAX30102 → 0x57 (HR/SpO2)
//   MPU-6050 → 0x68 (6-axis IMU)
//   TMP117   → 0x48 (precision temp)
//   ENS160   → 0x52 (air quality, ADDR=LOW to avoid LTR-390 conflict)
//   AHT21    → 0x38 (humidity + temp)
//   LTR-390  → 0x53 (UV + ambient light)
i2cBus.registerDevice(new MockMAX30102(0x57));
i2cBus.registerDevice(new MockMPU6050(0x68));
i2cBus.registerDevice(new MockTMP117(0x48));
i2cBus.registerDevice(new MockENS160(0x52));
i2cBus.registerDevice(new MockAHT21(0x38));
i2cBus.registerDevice(new MockLTR390(0x53));

self.onmessage = async (event) => {
  const { type, code, data } = event.data;
  if (type === 'INIT') {
    try {
      // Use dynamic import with @vite-ignore to prevent Vite from breaking it in production
      // @ts-ignore: TypeScript doesn't know about CDN imports
      const pyodideModule = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/pyodide/v0.26.1/full/pyodide.mjs');
      pyodide = await pyodideModule.loadPyodide();

      // ── Expose JS bridge functions to Python ──────────────────
      (self as any).simI2CWrite = (address: number, data: Uint8Array) => {
        i2cBus.write(address, data);
      };

      (self as any).simI2CRead = (address: number, length: number) => {
        return i2cBus.read(address, length);
      };

      (self as any).simSleep = (seconds: number) => {
        const cappedMs = Math.min(seconds * 1000, 2000);
        const start = performance.now();
        while (performance.now() - start < cappedMs) {
          // Busy wait (caps at 2s to avoid locking the worker forever)
        }
      };

      // ── stdout / stderr → main thread ─────────────────────────
      pyodide.setStdout({
        batched: (str: string) => {
          self.postMessage({ type: 'STDOUT', text: str });
        }
      });
      pyodide.setStderr({
        batched: (str: string) => {
          self.postMessage({ type: 'STDERR', text: str });
        }
      });

      // ── Create directory tree & inject modules ────────────────
      const FS = pyodide.FS;

      // Core CircuitPython platform APIs (our mocks)
      FS.writeFile('/lib/board.py', BOARD_MOCK);
      FS.writeFile('/lib/busio.py', BUSIO_MOCK);
      FS.writeFile('/lib/digitalio.py', DIGITALIO_MOCK);
      FS.writeFile('/lib/analogio.py', ANALOGIO_MOCK);
      FS.writeFile('/lib/supervisor.py', SUPERVISOR_MOCK);
      FS.writeFile('/lib/microcontroller.py', MICROCONTROLLER_MOCK);
      FS.writeFile('/lib/time.py', TIME_MOCK);
      FS.writeFile('/lib/micropython.py', MICROPYTHON_MOCK);
      FS.writeFile('/lib/circuitpython_typing.py', CIRCUITPYTHON_TYPING_MOCK);
      FS.writeFile('/lib/typing_extensions.py', 'from typing import *\n');

      // adafruit_ble package (mock — BLE can't run in browser)
      FS.mkdir('/lib/adafruit_ble');
      FS.writeFile('/lib/adafruit_ble/__init__.py', ADAFRUIT_BLE_INIT_MOCK);
      FS.mkdir('/lib/adafruit_ble/advertising');
      FS.writeFile('/lib/adafruit_ble/advertising/__init__.py', ADAFRUIT_BLE_ADV_INIT_MOCK);
      FS.writeFile('/lib/adafruit_ble/advertising/standard.py', ADAFRUIT_BLE_ADV_STANDARD_MOCK);
      FS.mkdir('/lib/adafruit_ble/services');
      FS.writeFile('/lib/adafruit_ble/services/__init__.py', ADAFRUIT_BLE_SERVICES_INIT_MOCK);
      FS.writeFile('/lib/adafruit_ble/services/nordic.py', ADAFRUIT_BLE_SERVICES_NORDIC_MOCK);

      // Sensor driver shims (talk to our JS I2C mocks)
      FS.writeFile('/lib/adafruit_mpu6050.py', ADAFRUIT_MPU6050_MOCK);
      FS.writeFile('/lib/adafruit_tmp117.py', ADAFRUIT_TMP117_MOCK);

      // Real Adafruit libraries from public/lib/ — fetch and inject
      // These use adafruit_bus_device + adafruit_register which need
      // to be loaded from the bundled copies.
      await _injectBundledLibraries(FS);

      // ── Add /lib to Python path ───────────────────────────────
      await pyodide.runPythonAsync(`
import sys
if '/lib' not in sys.path:
    sys.path.insert(0, '/lib')
      `);

      self.postMessage({ type: 'READY' });
    } catch (err: any) {
      self.postMessage({ type: 'ERROR', error: err.message });
    }

  } else if (type === 'RUN') {
    try {
      if (!pyodide) throw new Error("Pyodide not loaded");
      
      // Auto-convert synchronous time.sleep to await asyncio.sleep
      // This is CRITICAL: it forces the Python execution to yield to the JS event loop,
      // allowing the WebWorker to receive 'UPDATE_MOCK' messages from the UI sliders!
      let asyncCode = code.replace(/time\.sleep\((.*?)\)/g, 'await asyncio.sleep($1)');
      asyncCode = `import asyncio\n` + asyncCode;

      await pyodide.runPythonAsync(asyncCode);
      self.postMessage({ type: 'DONE' });
    } catch (err: any) {
      if (err.message && err.message.includes('SystemExit')) {
        self.postMessage({ type: 'STDOUT', text: '\n[SIM] Script exited (reset)\n' });
        self.postMessage({ type: 'DONE' });
      } else {
        self.postMessage({ type: 'ERROR', error: err.message });
      }
    }

  } else if (type === 'UPDATE_MOCK') {
    const { address, sensorData } = data;
    const device = i2cBus.getDevice(address);
    if (device) {
      device.updateSimulationData(sensorData);
    }
  }
};

/**
 * Fetch the real Adafruit driver Python files from public/lib/
 * and inject them into the Pyodide virtual filesystem.
 *
 * This gives us the full adafruit_bus_device, adafruit_register,
 * adafruit_ens160, adafruit_ahtx0, and adafruit_ltr390 libraries
 * running natively inside the browser.
 */
async function _injectBundledLibraries(FS: any) {
  const LIB_BASE = '/lib';

  // Helper: fetch a file from the Vite public dir and write into Pyodide FS
  async function injectFile(publicPath: string, fsPath: string) {
    try {
      const resp = await fetch(publicPath);
      if (!resp.ok) {
        console.warn(`[worker] Failed to fetch ${publicPath}: ${resp.status}`);
        return;
      }
      const text = await resp.text();
      FS.writeFile(fsPath, text);
    } catch (e) {
      console.warn(`[worker] Error injecting ${publicPath}:`, e);
    }
  }

  // adafruit_bus_device package
  FS.mkdir(`${LIB_BASE}/adafruit_bus_device`);
  await injectFile('/lib/adafruit_bus_device/__init__.py', `${LIB_BASE}/adafruit_bus_device/__init__.py`);
  await injectFile('/lib/adafruit_bus_device/i2c_device.py', `${LIB_BASE}/adafruit_bus_device/i2c_device.py`);

  // adafruit_register package
  FS.mkdir(`${LIB_BASE}/adafruit_register`);
  const registerFiles = [
    '__init__.py', 'i2c_bit.py', 'i2c_bits.py', 'i2c_struct.py',
    'i2c_struct_array.py', 'i2c_bcd_alarm.py', 'i2c_bcd_datetime.py',
  ];
  for (const f of registerFiles) {
    await injectFile(`/lib/adafruit_register/${f}`, `${LIB_BASE}/adafruit_register/${f}`);
  }

  // Individual sensor drivers (real Adafruit code)
  await injectFile('/lib/adafruit_ens160.py', `${LIB_BASE}/adafruit_ens160.py`);
  await injectFile('/lib/adafruit_ahtx0.py', `${LIB_BASE}/adafruit_ahtx0.py`);
  await injectFile('/lib/adafruit_ltr390.py', `${LIB_BASE}/adafruit_ltr390.py`);
}
