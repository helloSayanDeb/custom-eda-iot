import { MockDevice } from './MockDevice';

/**
 * MockENS160 — I2C register mock for ScioSense ENS160 air quality sensor.
 *
 * Address: 0x52 (ADDR=LOW, to avoid conflict with LTR-390 at 0x53)
 *
 * Key registers:
 *   0x00-0x01 — PART_ID (returns 0x0160 little-endian)
 *   0x10     — OPMODE
 *   0x20     — STATUS (data ready flags)
 *   0x21     — AQI (1-5)
 *   0x22-0x23 — TVOC (ppb, little-endian uint16)
 *   0x24-0x25 — eCO2 (ppm, little-endian uint16)
 */
export class MockENS160 extends MockDevice {
  constructor(address: number = 0x52) {
    super(address, 256);

    // PART_ID = 0x0160 little-endian
    this.registers[0x00] = 0x60;
    this.registers[0x01] = 0x01;

    // STATUS — data valid, new data available
    this.registers[0x20] = 0x02; // new_data_available bit

    // Default values
    this.updateSimulationData({
      aqi: 1,
      tvoc: 50,
      eco2: 400,
    });
  }

  public updateSimulationData(data: Record<string, number>): void {
    if (data.aqi !== undefined) {
      this.registers[0x21] = Math.max(1, Math.min(5, Math.round(data.aqi)));
    }
    if (data.tvoc !== undefined) {
      const tvoc = Math.max(0, Math.min(65000, Math.round(data.tvoc)));
      this.registers[0x22] = tvoc & 0xFF;
      this.registers[0x23] = (tvoc >> 8) & 0xFF;
    }
    if (data.eco2 !== undefined) {
      const eco2 = Math.max(400, Math.min(65000, Math.round(data.eco2)));
      this.registers[0x24] = eco2 & 0xFF;
      this.registers[0x25] = (eco2 >> 8) & 0xFF;
    }
  }
}
