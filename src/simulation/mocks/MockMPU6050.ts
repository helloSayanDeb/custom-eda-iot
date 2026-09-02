import { MockDevice } from './MockDevice';

export class MockMPU6050 extends MockDevice {
  constructor(address: number = 0x68) {
    super(address, 256);
    // WHO_AM_I
    this.registers[0x75] = 0x68;
    
    this.updateSimulationData({
      accelX: 0, accelY: 0, accelZ: 9.8,
      gyroX: 0, gyroY: 0, gyroZ: 0
    });
  }

  public updateSimulationData(data: Record<string, number>): void {
    // MPU6050 accel scale typically +/- 2g by default (16384 LSB/g)
    const ACCEL_SCALE = 16384;
    // MPU6050 gyro scale typically +/- 250 deg/s (131 LSB/deg/s)
    const GYRO_SCALE = 131;

    const write16 = (reg: number, val: number) => {
      const raw = Math.round(val);
      this.registers[reg] = (raw >> 8) & 0xFF;
      this.registers[reg + 1] = raw & 0xFF;
    };

    if (data.accelX !== undefined) write16(0x3B, (data.accelX / 9.80665) * ACCEL_SCALE);
    if (data.accelY !== undefined) write16(0x3D, (data.accelY / 9.80665) * ACCEL_SCALE);
    if (data.accelZ !== undefined) write16(0x3F, (data.accelZ / 9.80665) * ACCEL_SCALE);
    
    if (data.gyroX !== undefined) write16(0x43, data.gyroX * GYRO_SCALE);
    if (data.gyroY !== undefined) write16(0x45, data.gyroY * GYRO_SCALE);
    if (data.gyroZ !== undefined) write16(0x47, data.gyroZ * GYRO_SCALE);
  }
}
