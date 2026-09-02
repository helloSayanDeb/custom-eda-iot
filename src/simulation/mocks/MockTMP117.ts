import { MockDevice } from './MockDevice';

export class MockTMP117 extends MockDevice {
  constructor(address: number = 0x48) {
    super(address, 256);
    
    // TMP117 Device ID register 0x0F contains 0x0117
    this.registers[0x0F] = 0x01; 
    this.registers[0x10] = 0x17; // Wait, TMP117 uses 16-bit registers (word reads).
    
    // By default, let's set it to 25.0 C
    this.updateSimulationData({ temperature: 25.0 });
  }

  // I2C for TMP117 usually works in 16-bit word blocks, 
  // but we emulate memory linearly at the byte level for simplicity.
  // Wait, I2C addresses map to 16-bit registers on TMP117. 
  // So reg address 0x00 means we read 2 bytes from our memory mapping of 0x00 and 0x01.
  
  public updateSimulationData(data: Record<string, number>): void {
    if (data.temperature !== undefined) {
      // TMP117 resolution is 0.0078125 C per bit
      const raw = Math.round(data.temperature / 0.0078125);
      // MSB first
      this.registers[0x00] = (raw >> 8) & 0xFF;
      this.registers[0x01] = raw & 0xFF;
    }
  }

  // TMP117 I2C writes are always 1 byte register pointer + 2 bytes data.
  // So we intercept word writes.
  public write(data: Uint8Array): void {
    if (data.length === 0) return;
    this.currentRegister = data[0];
    
    // If it's a word write (3 bytes total: 1 reg, 2 data)
    if (data.length === 3) {
      // For TMP117, memory address for register X is just X. 
      // But we map it to this.registers[X*2] and [X*2+1] to store 16 bits.
      const regIdx = this.currentRegister * 2;
      this.registers[regIdx] = data[1];
      this.registers[regIdx + 1] = data[2];
    }
  }

  public read(length: number): Uint8Array {
    const result = new Uint8Array(length);
    // For TMP117, reading register X returns 2 bytes.
    const regIdx = this.currentRegister * 2;
    for (let i = 0; i < length; i++) {
      result[i] = this.registers[regIdx + i];
    }
    return result;
  }
}
