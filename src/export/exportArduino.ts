import type { Node, Edge } from '@xyflow/react'
import type { ComponentNodeData } from '../types'
import { COMPONENT_LIBRARY } from '../data/components'
import { runDRC } from '../validation/drc'

function getComponentsOnCanvas(nodes: Node[]) {
  return nodes
    .map(n => {
      const data = n.data as ComponentNodeData
      return COMPONENT_LIBRARY.find(c => c.typeId === data.typeId)
    })
    .filter(Boolean)
}

export function generateArduinoSketch(nodes: Node[], edges: Edge[]): string {
  // ── Block on CRITICAL_ERROR ────────────────────────────────────────────────
  const drcResults = runDRC(nodes, edges)
  const criticalError = drcResults.find(r => r.severity === 'CRITICAL_ERROR')
  if (criticalError) {
    throw new Error(`Export Blocked: ${criticalError.message} — ${criticalError.detail}`)
  }

  const components = getComponentsOnCanvas(nodes)
  const i2cComponents = components.filter(c => c && c.i2cAddresses.length > 0)
  const hasMCU = components.some(c => c?.typeId === 'xiao_ble_nrf52840')

  // Unique I2C addresses
  const addresses = new Map<string, string>()
  i2cComponents.forEach(c => {
    if (!c) return
    c.i2cAddresses.forEach(addr => {
      const key = addr.hex
      if (!addresses.has(key)) {
        addresses.set(key, c.shortLabel.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase())
      }
    })
  })

  // Check edge signals to find actual I2C bus (simplified)
  const _ = edges.length // use edges to avoid unused var warning

  const lines: string[] = [
    '/*',
    ' * ═══════════════════════════════════════════════════════════════════',
    ' * IoT Schematic Canvas — Auto-Generated Arduino/nRF52840 Sketch',
    ' * Generated: ' + new Date().toISOString(),
    ' * Target: Seeed Studio XIAO BLE (nRF52840)',
    ' * ═══════════════════════════════════════════════════════════════════',
    ' *',
    ' * Hardware I2C on XIAO BLE:',
    ' *   SDA → D4 (P0.02)',
    ' *   SCL → D5 (P0.03)',
    ' *',
    ' * Detected I2C Devices:',
    ...i2cComponents.map(c => {
      if (!c) return ''
      return ` *   ${c.shortLabel.padEnd(20)} ${c.i2cAddresses.map(a => a.hex + (a.condition ? ` (${a.condition})` : '')).join(' / ')}`
    }),
    ' *',
    ' * ⚠️  IMPORTANT NOTES:',
    ' *   - All GPIO/I2C are 3.3V logic ONLY (nRF52840 is NOT 5V tolerant!)',
    ' *   - Add 4.7kΩ pull-ups on SDA and SCL to 3.3V rail',
    ' *   - ENS160 ADDR pin must be pulled LOW for address 0x52 (avoid conflict with LTR-390)',
    ' *   - MPU-6050: AD0=LOW → 0x68, AD0=HIGH → 0x69',
    ' *   - MAX30102: Address 0x57 is fixed (not configurable)',
    ' *   - TMP117: ADD0 pin selects address 0x48/0x49/0x4A/0x4B',
    ' * ═══════════════════════════════════════════════════════════════════',
    ' */',
    '',
    '// ── Library Includes ─────────────────────────────────────────────────',
    '#include <Wire.h>',
  ]

  if (i2cComponents.some(c => c?.typeId === 'max30102')) {
    lines.push('#include <MAX30105.h>         // SparkFun MAX3010x library')
    lines.push('#include <heartRate.h>')
    lines.push('#include <spo2_algorithm.h>')
  }
  if (i2cComponents.some(c => c?.typeId === 'mpu6050')) {
    lines.push('#include <Adafruit_MPU6050.h>   // Adafruit MPU6050 library')
    lines.push('#include <Adafruit_Sensor.h>')
  }
  if (i2cComponents.some(c => c?.typeId === 'tmp117')) {
    lines.push('#include <SparkFun_TMP117.h>    // SparkFun TMP117 library')
  }
  if (i2cComponents.some(c => c?.typeId === 'ens160_aht21')) {
    lines.push('#include <DFRobot_ENS160.h>     // DFRobot ENS160')
    lines.push('#include <DFRobot_AHT20.h>      // DFRobot AHT20/AHT21')
  }
  if (i2cComponents.some(c => c?.typeId === 'ltr390')) {
    lines.push('#include <Adafruit_LTR390.h>    // Adafruit LTR-390')
  }

  lines.push('')
  lines.push('// ── I2C Address Definitions ──────────────────────────────────────────')
  addresses.forEach((label, hex) => {
    lines.push(`#define ADDR_${label.padEnd(20)} ${hex}`)
  })

  if (hasMCU) {
    lines.push('')
    lines.push('// ── XIAO BLE nRF52840 I2C Pins ───────────────────────────────────────')
    lines.push('#define I2C_SDA    4    // D4 = P0.02')
    lines.push('#define I2C_SCL    5    // D5 = P0.03')
  }

  lines.push('')
  lines.push('// ── Sensor Object Instances ──────────────────────────────────────────')

  if (i2cComponents.some(c => c?.typeId === 'max30102')) {
    lines.push('MAX30105 particleSensor;          // MAX30102 pulse oximeter')
  }
  if (i2cComponents.some(c => c?.typeId === 'mpu6050')) {
    lines.push('Adafruit_MPU6050 mpu;             // MPU-6050 6-axis IMU')
  }
  if (i2cComponents.some(c => c?.typeId === 'tmp117')) {
    lines.push('TMP117 tmpSensor;                 // TMP117 precision temperature')
  }
  if (i2cComponents.some(c => c?.typeId === 'ens160_aht21')) {
    lines.push('DFRobot_ENS160_I2C ens160;        // ENS160 air quality (addr 0x52)')
    lines.push('DFRobot_AHT20 aht21;              // AHT21 humidity + temperature')
  }
  if (i2cComponents.some(c => c?.typeId === 'ltr390')) {
    lines.push('Adafruit_LTR390 ltr390;           // LTR-390 UV + ambient light')
  }

  lines.push('')
  lines.push('// ═══════════════════════════════════════════════════════════════════')
  lines.push('void setup() {')
  lines.push('  Serial.begin(115200);')
  lines.push('  while (!Serial) delay(10);')
  lines.push('  Serial.println("\\n[INIT] IoT Wearable Device — nRF52840");')
  lines.push('')
  lines.push('  // Initialize I2C bus')
  lines.push('  Wire.begin(I2C_SDA, I2C_SCL);')
  lines.push('  Wire.setClock(400000);            // 400kHz Fast Mode')
  lines.push('')

  if (i2cComponents.some(c => c?.typeId === 'max30102')) {
    lines.push('  // ── MAX30102 Pulse Oximeter (0x57) ──────────────────────────────')
    lines.push('  if (!particleSensor.begin(Wire, I2C_SPEED_FAST, ADDR_MAX30102)) {')
    lines.push('    Serial.println("[ERR] MAX30102 not found — check wiring!");')
    lines.push('  } else {')
    lines.push('    particleSensor.setup();         // Configure with default settings')
    lines.push('    particleSensor.setPulseAmplitudeRed(0x0A);')
    lines.push('    particleSensor.setPulseAmplitudeIR(0x0A);')
    lines.push('    Serial.println("[OK]  MAX30102 ready");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'mpu6050')) {
    lines.push('  // ── MPU-6050 IMU (0x68) ──────────────────────────────────────────')
    lines.push('  if (!mpu.begin(0x68, &Wire)) {')
    lines.push('    Serial.println("[ERR] MPU-6050 not found — check AD0 pin!");')
    lines.push('  } else {')
    lines.push('    mpu.setAccelerometerRange(MPU6050_RANGE_8_G);')
    lines.push('    mpu.setGyroRange(MPU6050_RANGE_500_DEG);')
    lines.push('    mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);')
    lines.push('    Serial.println("[OK]  MPU-6050 ready");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'tmp117')) {
    lines.push('  // ── TMP117 Temperature (0x48) ────────────────────────────────────')
    lines.push('  if (!tmpSensor.begin(0x48, Wire)) {')
    lines.push('    Serial.println("[ERR] TMP117 not found — check ADD0 pin!");')
    lines.push('  } else {')
    lines.push('    tmpSensor.setConversionMode(TMP117_ONE_SHOT);')
    lines.push('    Serial.println("[OK]  TMP117 ready");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'ens160_aht21')) {
    lines.push('  // ── AHT21 Humidity + Temperature (0x38) ─────────────────────────')
    lines.push('  if (aht21.begin() != 0) {')
    lines.push('    Serial.println("[ERR] AHT21 not found!");')
    lines.push('  } else {')
    lines.push('    Serial.println("[OK]  AHT21 ready");')
    lines.push('  }')
    lines.push('')
    lines.push('  // ── ENS160 Air Quality (0x52 — ADDR=LOW) ─────────────────────────')
    lines.push('  // NOTE: ADDR pin must be pulled LOW to use 0x52 (avoids LTR-390 conflict)')
    lines.push('  Wire.beginTransmission(0x52);')
    lines.push('  if (Wire.endTransmission() == 0) {')
    lines.push('    while (NO_ERR != ens160.begin(&Wire, 0x52)) {')
    lines.push('      Serial.println("[WAIT] ENS160 init...");')
    lines.push('      delay(3000);')
    lines.push('    }')
    lines.push('    ens160.setPWRMode(ENS160_STANDARD_MODE);')
    lines.push('    Serial.println("[OK]  ENS160 ready @ 0x52");')
    lines.push('  } else {')
    lines.push('    Serial.println("[ERR] ENS160 not found at 0x52 — check ADDR pin!");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'ltr390')) {
    lines.push('  // ── LTR-390 UV + ALS (0x53 — fixed) ─────────────────────────────')
    lines.push('  if (!ltr390.begin()) {')
    lines.push('    Serial.println("[ERR] LTR-390 not found at 0x53!");')
    lines.push('  } else {')
    lines.push('    ltr390.setMode(LTR390_MODE_UVS);')
    lines.push('    ltr390.setGain(LTR390_GAIN_3);')
    lines.push('    ltr390.setResolution(LTR390_RESOLUTION_16BIT);')
    lines.push('    Serial.println("[OK]  LTR-390 ready @ 0x53");')
    lines.push('  }')
    lines.push('')
  }

  lines.push('  Serial.println("[INIT] All sensors initialized\\n");')
  lines.push('}')
  lines.push('')
  lines.push('// ═══════════════════════════════════════════════════════════════════')
  lines.push('void loop() {')
  lines.push('  unsigned long t = millis();')
  lines.push('  Serial.println("───── Sensor Readings ─────");')
  lines.push('  Serial.print("[T="); Serial.print(t); Serial.println("ms]");')
  lines.push('')

  if (i2cComponents.some(c => c?.typeId === 'tmp117')) {
    lines.push('  // TMP117 Temperature')
    lines.push('  if (tmpSensor.dataReady()) {')
    lines.push('    float tempC = tmpSensor.readTempC();')
    lines.push('    Serial.print("  Temp     : "); Serial.print(tempC, 4); Serial.println(" °C");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'ens160_aht21')) {
    lines.push('  // AHT21 Humidity')
    lines.push('  if (aht21.startMeasurementReady(true)) {')
    lines.push('    Serial.print("  Humidity : "); Serial.print(aht21.getHumidity_RH(), 1); Serial.println(" %RH");')
    lines.push('    Serial.print("  AHT Temp : "); Serial.print(aht21.getTemperature_C(), 1); Serial.println(" °C");')
    lines.push('    ens160.setTempAndHum(aht21.getTemperature_C(), aht21.getHumidity_RH());')
    lines.push('  }')
    lines.push('  // ENS160 Air Quality')
    lines.push('  uint8_t aqiVal = ens160.getAQI();')
    lines.push('  uint16_t tvoc  = ens160.getTVOC();')
    lines.push('  uint16_t eco2  = ens160.getECO2();')
    lines.push('  Serial.print("  AQI      : "); Serial.println(aqiVal);')
    lines.push('  Serial.print("  TVOC     : "); Serial.print(tvoc); Serial.println(" ppb");')
    lines.push('  Serial.print("  eCO2     : "); Serial.print(eco2); Serial.println(" ppm");')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'ltr390')) {
    lines.push('  // LTR-390 UV + Ambient Light')
    lines.push('  if (ltr390.newDataAvailable()) {')
    lines.push('    ltr390.setMode(LTR390_MODE_UVS);')
    lines.push('    delay(100);')
    lines.push('    uint32_t uv = ltr390.readUVS();')
    lines.push('    Serial.print("  UV Index : "); Serial.println((float)uv / 2300.0f, 2);')
    lines.push('    ltr390.setMode(LTR390_MODE_ALS);')
    lines.push('    delay(100);')
    lines.push('    uint32_t als = ltr390.readALS();')
    lines.push('    Serial.print("  Ambient  : "); Serial.print((float)als * 0.6f, 1); Serial.println(" lux");')
    lines.push('  }')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'mpu6050')) {
    lines.push('  // MPU-6050 IMU')
    lines.push('  sensors_event_t accel, gyro, temp;')
    lines.push('  mpu.getEvent(&accel, &gyro, &temp);')
    lines.push('  Serial.print("  Accel    : X="); Serial.print(accel.acceleration.x, 2);')
    lines.push('  Serial.print(" Y="); Serial.print(accel.acceleration.y, 2);')
    lines.push('  Serial.print(" Z="); Serial.println(accel.acceleration.z, 2);')
    lines.push('  Serial.print("  Gyro     : X="); Serial.print(gyro.gyro.x, 2);')
    lines.push('  Serial.print(" Y="); Serial.print(gyro.gyro.y, 2);')
    lines.push('  Serial.print(" Z="); Serial.println(gyro.gyro.z, 2);')
    lines.push('')
  }

  if (i2cComponents.some(c => c?.typeId === 'max30102')) {
    lines.push('  // MAX30102 Pulse Oximeter')
    lines.push('  long irValue = particleSensor.getIR();')
    lines.push('  Serial.print("  IR       : "); Serial.println(irValue);')
    lines.push('  if (irValue > 50000) {')
    lines.push('    Serial.println("  Heart    : [finger detected — compute BPM]");')
    lines.push('  }')
    lines.push('')
  }

  lines.push('  delay(2000);')
  lines.push('}')
  lines.push('')
  lines.push('// ═══════════════════════════════════════════════════════════════════')
  lines.push('// I2C Bus Scanner — Run once in setup() to verify addresses')
  lines.push('// ═══════════════════════════════════════════════════════════════════')
  lines.push('void scanI2CBus() {')
  lines.push('  Serial.println("\\n[SCAN] I2C Bus Scanner:");')
  lines.push('  byte found = 0;')
  lines.push('  for (byte addr = 1; addr < 127; addr++) {')
  lines.push('    Wire.beginTransmission(addr);')
  lines.push('    byte error = Wire.endTransmission();')
  lines.push('    if (error == 0) {')
  lines.push('      Serial.print("  Found device at 0x");')
  lines.push('      if (addr < 16) Serial.print("0");')
  lines.push('      Serial.println(addr, HEX);')
  lines.push('      found++;')
  lines.push('    }')
  lines.push('  }')
  lines.push('  if (found == 0) Serial.println("  No I2C devices found!");')
  lines.push('  else { Serial.print("  Total: "); Serial.println(found); }')
  lines.push('}')

  return lines.join('\n')
}

export function downloadArduinoSketch(nodes: Node[], edges: Edge[]): void {
  const content = generateArduinoSketch(nodes, edges)
  const blob = new Blob([content], { type: 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'iot_wearable_xiao_ble.ino'
  a.click()
  URL.revokeObjectURL(url)
}
