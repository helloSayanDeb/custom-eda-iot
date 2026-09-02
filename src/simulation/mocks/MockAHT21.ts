import { MockDevice } from './MockDevice';

/**
 * MockAHT21 — I2C mock for the AHT21 temperature + humidity sensor.
 *
 * Address: 0x38 (fixed)
 *
 * The AHT21 uses a command-based protocol, not simple registers:
 *   - Write 0xBE to calibrate
 *   - Write [0xAC, 0x33, 0x00] to trigger measurement
 *   - Read 7 bytes: status + 5 data bytes + CRC
 *
 * Data format (after trigger):
 *   Byte 0: Status (bit 7 = busy, bit 3 = calibrated)
 *   Bytes 1-2 + top 4 bits of byte 3: humidity (20-bit)
 *   Bottom 4 bits of byte 3 + bytes 4-5: temperature (20-bit)
 *   Byte 6: CRC (we just return 0x00)
 */
export class MockAHT21 extends MockDevice {
  private humidity: number = 50.0;    // %RH
  private temperature: number = 25.0; // °C
  private lastCommand: number = 0;

  constructor(address: number = 0x38) {
    super(address, 16);
  }

  public write(data: Uint8Array): void {
    if (data.length > 0) {
      this.lastCommand = data[0];
    }
  }

  /**
   * AHT21 reads return 7 bytes after a measurement trigger:
   * [status, hum[19:12], hum[11:4], (hum[3:0]<<4 | temp[19:16]),
   *  temp[15:8], temp[7:0], crc]
   */
  public read(length: number): Uint8Array {
    const result = new Uint8Array(length);

    if (length >= 7) {
      // Status: not busy (0x00) + calibrated (0x08) = 0x08 idle & calibrated
      result[0] = 0x08;

      // Humidity: raw = humidity / 100 * 2^20
      const rawHum = Math.round((this.humidity / 100.0) * 1048576);
      result[1] = (rawHum >> 12) & 0xFF;
      result[2] = (rawHum >> 4) & 0xFF;

      // Temperature: raw = (temperature + 50) / 200 * 2^20
      const rawTemp = Math.round(((this.temperature + 50.0) / 200.0) * 1048576);
      // Byte 3 shares: top nibble = hum[3:0], bottom nibble = temp[19:16]
      result[3] = ((rawHum & 0x0F) << 4) | ((rawTemp >> 16) & 0x0F);
      result[4] = (rawTemp >> 8) & 0xFF;
      result[5] = rawTemp & 0xFF;

      // CRC
      result[6] = 0x00;
    } else if (length === 1) {
      // Status read — calibrated, not busy
      result[0] = 0x08;
    }

    return result;
  }

  public updateSimulationData(data: Record<string, number>): void {
    if (data.temperature !== undefined) {
      this.temperature = Math.max(-40, Math.min(85, data.temperature));
    }
    if (data.humidity !== undefined) {
      this.humidity = Math.max(0, Math.min(100, data.humidity));
    }
  }
}
