import { MockDevice } from './MockDevice';

/**
 * MockLTR390 — I2C register mock for the LTR-390UV UV & Ambient Light sensor.
 *
 * Address: 0x53 (fixed, hardwired)
 *
 * Key registers:
 *   0x00     — MAIN_CTRL (bit 1 = ALS/UV mode, bit 3 = enable)
 *   0x04     — MEAS_RATE (resolution + rate)
 *   0x05     — GAIN
 *   0x06     — PART_ID (returns 0xB2: part number 0x0B, revision 0x02)
 *   0x07     — STATUS (bit 3 = data ready)
 *   0x0D-0x0F — ALS_DATA (20-bit, 3 bytes little-endian)
 *   0x10-0x12 — UVS_DATA (20-bit, 3 bytes little-endian)
 */
export class MockLTR390 extends MockDevice {
  private uvIndex: number = 2.0;
  private lux: number = 500;

  constructor(address: number = 0x53) {
    super(address, 256);

    // PART_ID: part = 0x0B (bits 7:4), revision = 0x02 (bits 3:0) → 0xB2
    this.registers[0x06] = 0xB2;

    // STATUS — data ready
    this.registers[0x07] = 0x08;

    // MAIN_CTRL — enabled, ALS mode
    this.registers[0x00] = 0x02;

    // Default gain = 3 (x3)
    this.registers[0x05] = 0x01;

    // Default resolution = 18-bit, rate = 100ms
    this.registers[0x04] = 0x22;

    this.updateSimulationData({ uvIndex: 2.0, lux: 500 });
  }

  /**
   * Convert lux to raw ALS data.
   * Formula (from datasheet): Lux = (0.6 * ALSDATA) / (GAIN * INT_TIME)
   * Default gain=3, integration=100ms → Lux = 0.6 * ALSDATA / (3 * 1)
   * → ALSDATA = Lux * 3 / 0.6 = Lux * 5
   */
  private luxToRawALS(lux: number): number {
    return Math.round(Math.max(0, Math.min(0xFFFFF, lux * 5)));
  }

  /**
   * Convert UV Index to raw UVS data.
   * Formula: UVI = UVSDATA / sensitivity
   * Default sensitivity factor ≈ 2300 (gain=18x, 20-bit resolution)
   * For gain=3, 18-bit: sensitivity ≈ 100
   */
  private uvIndexToRawUVS(uvIndex: number): number {
    return Math.round(Math.max(0, Math.min(0xFFFFF, uvIndex * 100)));
  }

  private write20bit(baseReg: number, value: number): void {
    this.registers[baseReg]     = value & 0xFF;
    this.registers[baseReg + 1] = (value >> 8) & 0xFF;
    this.registers[baseReg + 2] = (value >> 16) & 0x0F;
  }

  public updateSimulationData(data: Record<string, number>): void {
    if (data.uvIndex !== undefined) {
      this.uvIndex = Math.max(0, Math.min(15, data.uvIndex));
      this.write20bit(0x10, this.uvIndexToRawUVS(this.uvIndex));
    }
    if (data.lux !== undefined) {
      this.lux = Math.max(0, Math.min(100000, data.lux));
      this.write20bit(0x0D, this.luxToRawALS(this.lux));
    }
    // Keep data ready bit set
    this.registers[0x07] = 0x08;
  }
}
