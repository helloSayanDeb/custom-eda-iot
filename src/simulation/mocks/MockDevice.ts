export abstract class MockDevice {
  public address: number;
  protected registers: Uint8Array;
  protected currentRegister: number = 0;

  constructor(address: number, memorySize: number = 256) {
    this.address = address;
    this.registers = new Uint8Array(memorySize);
  }

  // Handle a write transaction (I2C write)
  public write(data: Uint8Array): void {
    if (data.length === 0) return;
    
    // First byte is usually the register address
    this.currentRegister = data[0];
    
    // Remaining bytes are data to write
    for (let i = 1; i < data.length; i++) {
      this.writeRegister(this.currentRegister + i - 1, data[i]);
    }
  }

  // Handle a read transaction (I2C read)
  public read(length: number): Uint8Array {
    const result = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
      result[i] = this.readRegister(this.currentRegister + i);
    }
    return result;
  }

  // Override this if the device needs special side-effects on write
  protected writeRegister(reg: number, val: number): void {
    if (reg < this.registers.length) {
      this.registers[reg] = val;
    }
  }

  // Override this if the device needs to compute data on read
  protected readRegister(reg: number): number {
    if (reg < this.registers.length) {
      return this.registers[reg];
    }
    return 0xFF;
  }

  // Method to update simulated real-world data (called by UI React State)
  public abstract updateSimulationData(data: Record<string, number>): void;
}
