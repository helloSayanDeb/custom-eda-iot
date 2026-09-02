import { MockDevice } from './MockDevice';

/**
 * MockMAX30102 — Byte-level I2C register mock for the MAX30102
 * pulse oximeter / heart rate sensor.
 *
 * Address: 0x57
 *
 * Key registers simulated:
 *   0x04 — FIFO_WR_PTR
 *   0x05 — OVF_COUNTER
 *   0x06 — FIFO_RD_PTR
 *   0x07 — FIFO_DATA (returns 6 bytes: RED[17:0] + IR[17:0])
 *   0x08 — FIFO_CONFIG
 *   0x09 — MODE_CONFIG (bit 6 = reset, bit 7 = shutdown)
 *   0x0A — SPO2_CONFIG
 *   0x0C — LED1_PA (Red LED current)
 *   0x0D — LED2_PA (IR LED current)
 *   0xFF — PART_ID (returns 0x15)
 *
 * The FIFO auto-advances on read — each read returns a fresh
 * 6-byte sample derived from the current simulated heart rate
 * and SpO2 values. A simple sine wave generator creates the
 * pulsatile waveform the HR algorithm expects.
 */
export class MockMAX30102 extends MockDevice {
  private isShutdown: boolean = false;
  private sampleIndex: number = 0;

  // Simulated input values (set from UI sliders)
  private heartRateBpm: number = 72;
  private spo2Pct: number = 98;

  // FIFO pointer state
  private fifoWritePtr: number = 0;
  private fifoReadPtr: number = 0;

  constructor(address: number = 0x57) {
    super(address, 256);

    // Part ID
    this.registers[0xFF] = 0x15;
    // Revision ID
    this.registers[0xFE] = 0x06;

    // Init FIFO pointers
    this.registers[0x04] = 0;
    this.registers[0x05] = 0;
    this.registers[0x06] = 0;

    // Start generating samples
    this._startSampleGeneration();
  }

  private _startSampleGeneration(): void {
    // Auto-generate samples at ~100Hz equivalent by advancing
    // the write pointer periodically. In the worker's busy-loop
    // context this is driven by the read cadence instead.
  }

  /**
   * Generate a synthetic PPG (photoplethysmography) sample.
   * The waveform is a simple sine pulse at the configured BPM
   * so the HRProcessor's peak detector has something realistic
   * to lock onto.
   */
  private _generateSample(): { red: number; ir: number } {
    const samplesPerBeat = (60 / this.heartRateBpm) * 100; // at 100 Hz
    const phase = (this.sampleIndex % samplesPerBeat) / samplesPerBeat;

    // Pulsatile component — sharp systolic peak via squared sine
    const pulse = Math.sin(phase * 2 * Math.PI);
    const pulseSq = pulse > 0 ? pulse * pulse : 0;

    // DC baseline + AC component.
    // IR has higher DC and lower AC (higher SpO2 = lower R ratio).
    const irDC = 135000;
    const redDC = 130000;

    // R ratio determines SpO2:  SpO2 ≈ -45.06 * R^2 + 30.35 * R + 94.85
    // Solve for R given target SpO2 — for typical range, R ≈ 0.4..0.8
    // We just set relative AC amplitudes to produce the desired R ratio.
    const targetR = Math.max(0.4, Math.min(1.0,
      (-30.354 + Math.sqrt(30.354 * 30.354 + 4 * 45.06 * (this.spo2Pct - 94.845))) / (2 * -45.06)
    ));

    const irAC = 800;
    const redAC = irAC * targetR * (redDC / irDC); // Scale to produce correct R

    const ir  = Math.round(irDC  + irAC  * pulseSq);
    const red = Math.round(redDC + redAC * pulseSq);

    this.sampleIndex++;
    return { red, ir };
  }

  protected writeRegister(reg: number, val: number): void {
    super.writeRegister(reg, val);

    // MODE_CONFIG special handling
    if (reg === 0x09) {
      if (val & 0x40) {
        // Reset
        this.fifoWritePtr = 0;
        this.fifoReadPtr = 0;
        this.sampleIndex = 0;
        this.isShutdown = false;
      }
      if (val & 0x80) {
        this.isShutdown = true;
      } else if (val === 0x03) {
        // SpO2 mode — wake up
        this.isShutdown = false;
      }
    }

    // FIFO pointer resets
    if (reg === 0x04) this.fifoWritePtr = val & 0x1F;
    if (reg === 0x06) this.fifoReadPtr = val & 0x1F;
  }

  protected readRegister(reg: number): number {
    if (reg === 0x04) {
      // Advance write pointer ahead of read pointer to simulate data available
      if (!this.isShutdown) {
        this.fifoWritePtr = (this.fifoReadPtr + 1) & 0x1F;
      }
      return this.fifoWritePtr;
    }
    if (reg === 0x06) return this.fifoReadPtr;
    return super.readRegister(reg);
  }

  /**
   * Override read to handle the FIFO_DATA register specially.
   * When Python reads 6 bytes from reg 0x07, we generate a
   * fresh Red+IR sample and advance the read pointer.
   */
  public read(length: number): Uint8Array {
    if (this.currentRegister === 0x07 && length === 6) {
      if (this.isShutdown) {
        return new Uint8Array(6); // all zeros when shutdown
      }

      const { red, ir } = this._generateSample();
      const result = new Uint8Array(6);
      // 18-bit values, upper 2 bits in byte 0 bits [1:0]
      result[0] = (red >> 16) & 0x03;
      result[1] = (red >> 8)  & 0xFF;
      result[2] = red & 0xFF;
      result[3] = (ir >> 16)  & 0x03;
      result[4] = (ir >> 8)   & 0xFF;
      result[5] = ir & 0xFF;

      // Advance read pointer
      this.fifoReadPtr = (this.fifoReadPtr + 1) & 0x1F;
      return result;
    }
    return super.read(length);
  }

  public updateSimulationData(data: Record<string, number>): void {
    if (data.heartRate !== undefined) {
      this.heartRateBpm = Math.max(30, Math.min(200, data.heartRate));
    }
    if (data.spo2 !== undefined) {
      this.spo2Pct = Math.max(70, Math.min(100, data.spo2));
    }
  }
}
