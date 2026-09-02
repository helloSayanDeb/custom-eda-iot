import { MockDevice } from './MockDevice';

export class MockI2CBus {
  private devices: Map<number, MockDevice> = new Map();

  public registerDevice(device: MockDevice) {
    this.devices.set(device.address, device);
  }

  public getDevice(address: number): MockDevice | undefined {
    return this.devices.get(address);
  }

  public write(address: number, data: Uint8Array): boolean {
    const device = this.devices.get(address);
    if (device) {
      device.write(data);
      return true;
    }
    console.warn(`[MockI2CBus] Write to unregistered address: 0x${address.toString(16)}`);
    return false;
  }

  public read(address: number, length: number): Uint8Array {
    const device = this.devices.get(address);
    if (device) {
      return device.read(length);
    }
    console.warn(`[MockI2CBus] Read from unregistered address: 0x${address.toString(16)}`);
    return new Uint8Array(length).fill(0xFF);
  }
}

// Global singleton bus for the simulation
export const i2cBus = new MockI2CBus();
