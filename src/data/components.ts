// ─────────────────────────────────────────────────────────────────────────────
//  Hardware Component Definitions
//  Based on actual datasheets in References/ folder
//  All pinouts, voltages, and I2C addresses are from official documentation
// ─────────────────────────────────────────────────────────────────────────────

import type { ComponentDefinition, SignalType } from '../types'

// ─── Signal Type Color Map ────────────────────────────────────────────────────
export const SIGNAL_COLORS: Record<SignalType, string> = {
  POWER_3V3: '#ef4444',   // Red
  POWER_5V:  '#f97316',   // Orange-red (danger for 3.3V systems)
  GND:       '#374151',   // Dark gray / black
  SDA:       '#3b82f6',   // Blue
  SCL:       '#eab308',   // Yellow
  GPIO:      '#22c55e',   // Green
  INT:       '#a78bfa',   // Purple
  BAT_POS:   '#fb923c',   // Orange
  BAT_NEG:   '#6b7280',   // Gray
  ADDR:      '#06b6d4',   // Cyan
  XDA:       '#60a5fa',   // Light blue
  XCL:       '#fbbf24',   // Amber
  CS:        '#f472b6',   // Pink
  ALERT:     '#f59e0b',   // Amber
  ANALOG:    '#34d399',   // Emerald
  NC:        '#4b5563',   // Gray
}

// ─── Signal Type Labels ───────────────────────────────────────────────────────
export const SIGNAL_LABELS: Record<SignalType, string> = {
  POWER_3V3: '3.3V Power',
  POWER_5V:  '5V Power',
  GND:       'Ground',
  SDA:       'I2C SDA',
  SCL:       'I2C SCL',
  GPIO:      'GPIO',
  INT:       'Interrupt',
  BAT_POS:   'Battery +',
  BAT_NEG:   'Battery -',
  ADDR:      'Address Select',
  XDA:       'Aux I2C SDA',
  XCL:       'Aux I2C SCL',
  CS:        'Chip Select (SPI)',
  ALERT:     'Alert/DRDY',
  ANALOG:    'Analog Signal',
  NC:        'Not Connected',
}

// ─────────────────────────────────────────────────────────────────────────────
//  1. Seeed Studio XIAO BLE (nRF52840)
//  Datasheet: nRF52840.pdf
//  Logic: 3.3V strictly — NO 5V tolerance on GPIO
//  I2C: D4 = SDA (P0.02), D5 = SCL (P0.03)
// ─────────────────────────────────────────────────────────────────────────────
export const XIAO_BLE: ComponentDefinition = {
  typeId: 'xiao_ble_nrf52840',
  label: 'Seeed XIAO BLE (nRF52840)',
  shortLabel: 'XIAO BLE',
  category: 'MCU',
  description: 'ARM Cortex-M4 @ 64MHz, Bluetooth 5.0, 3.3V logic, 256KB RAM / 1MB Flash. I2C on D4(SDA)/D5(SCL).',
  voltageRating: 3.3,
  color: '#6366f1',
  icon: '🧠',
  width: 220,
  height: 340,
  arduinoLib: 'Wire.h (built-in)',
  i2cAddresses: [],
  notes: [
    'GPIO pins are 3.3V logic only — NOT 5V tolerant!',
    'VUSB can supply 5V from USB, but all GPIO operate at 3.3V',
    'I2C SDA = D4 (P0.02), SCL = D5 (P0.03)',
    'Built-in LiPo charger via BAT+/BAT- pads',
    'Max current per GPIO: 5mA. Total GPIO: 15mA',
  ],
  pins: [
    // Left side — power rails
    { id: 'vcc_3v3', label: '3V3', signal: 'POWER_3V3', direction: 'out', side: 'left', position: 0.05 },
    { id: 'gnd1',    label: 'GND', signal: 'GND',       direction: 'power', side: 'left', position: 0.15 },
    { id: 'bat_pos', label: 'BAT+',signal: 'BAT_POS',   direction: 'in',  side: 'left', position: 0.25 },
    { id: 'bat_neg', label: 'BAT-',signal: 'BAT_NEG',   direction: 'in',  side: 'left', position: 0.35 },
    { id: 'd0',      label: 'D0',  signal: 'GPIO',      direction: 'inout', side: 'left', position: 0.50 },
    { id: 'd1',      label: 'D1',  signal: 'GPIO',      direction: 'inout', side: 'left', position: 0.60 },
    { id: 'd2',      label: 'D2',  signal: 'GPIO',      direction: 'inout', side: 'left', position: 0.70 },
    { id: 'd3',      label: 'D3',  signal: 'GPIO',      direction: 'inout', side: 'left', position: 0.80 },
    { id: 'gnd2',    label: 'GND', signal: 'GND',       direction: 'power', side: 'left', position: 0.92 },
    // Right side — I2C + GPIO
    { id: 'd4_sda',  label: 'D4/SDA', signal: 'SDA',   direction: 'inout', side: 'right', position: 0.10 },
    { id: 'd5_scl',  label: 'D5/SCL', signal: 'SCL',   direction: 'inout', side: 'right', position: 0.20 },
    { id: 'd6',      label: 'D6',  signal: 'GPIO',      direction: 'inout', side: 'right', position: 0.35 },
    { id: 'd7',      label: 'D7',  signal: 'GPIO',      direction: 'inout', side: 'right', position: 0.45 },
    { id: 'd8',      label: 'D8',  signal: 'GPIO',      direction: 'inout', side: 'right', position: 0.55 },
    { id: 'd9',      label: 'D9',  signal: 'GPIO',      direction: 'inout', side: 'right', position: 0.65 },
    { id: 'd10',     label: 'D10', signal: 'GPIO',      direction: 'inout', side: 'right', position: 0.75 },
    { id: 'vusb',    label: 'VUSB',signal: 'POWER_5V',  direction: 'in',  side: 'right', position: 0.90 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  2. MAX30102 Pulse Oximeter & Heart-Rate Sensor
//  Datasheet: MAX30102.pdf
//  I2C Address: 0x57 (fixed, not configurable)
//  VIN: 3.3V (breakout has onboard regulator for the 1.8V LED supply)
//  INT: Active LOW interrupt, open-drain
// ─────────────────────────────────────────────────────────────────────────────
export const MAX30102: ComponentDefinition = {
  typeId: 'max30102',
  label: 'MAX30102 Pulse Oximeter',
  shortLabel: 'MAX30102',
  category: 'Sensor',
  description: 'Integrated pulse oximetry and heart-rate monitor. Red (660nm) + IR (880nm) LEDs. I2C @ 0x57.',
  voltageRating: 3.3,
  color: '#ef4444',
  icon: '❤️',
  width: 180,
  height: 200,
  arduinoLib: 'SparkFun MAX3010x / Protocentral MAX30102',
  i2cAddresses: [
    { hex: '0x57', condition: 'Fixed — not configurable' }
  ],
  notes: [
    'I2C address 0x57 is hardwired — cannot change',
    'VIN accepts 3.3V–5V on breakout boards (onboard LDO)',
    'INT pin is active LOW, open-drain — needs pull-up',
    'SDA/SCL operate at VIN voltage level on breakout',
    'Max 400kHz I2C (Fast Mode)',
  ],
  pins: [
    { id: 'vin',  label: 'VIN',  signal: 'POWER_3V3', direction: 'in',    side: 'left', position: 0.15 },
    { id: 'gnd',  label: 'GND',  signal: 'GND',       direction: 'power', side: 'left', position: 0.35 },
    { id: 'scl',  label: 'SCL',  signal: 'SCL',       direction: 'in',    side: 'left', position: 0.55 },
    { id: 'sda',  label: 'SDA',  signal: 'SDA',       direction: 'inout', side: 'left', position: 0.70 },
    { id: 'int',  label: 'INT',  signal: 'INT',       direction: 'out',   side: 'left', position: 0.88 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  3. MPU-6050 6-Axis IMU (Accel + Gyro)
//  Datasheet: MPU6050.pdf
//  I2C Address: 0x68 (AD0=LOW/float) or 0x69 (AD0=HIGH)
//  VCC: 3.3V (breakout has onboard LDO for 2.5V core)
//  Auxiliary I2C master: XDA/XCL for external magnetometer
// ─────────────────────────────────────────────────────────────────────────────
export const MPU6050: ComponentDefinition = {
  typeId: 'mpu6050',
  label: 'MPU-6050 6-Axis IMU',
  shortLabel: 'MPU-6050',
  category: 'Sensor',
  description: '3-axis accel ±2/4/8/16g, 3-axis gyro ±250–2000°/s. DMP onboard. I2C @ 0x68 or 0x69.',
  voltageRating: 3.3,
  color: '#8b5cf6',
  icon: '🔄',
  width: 180,
  height: 240,
  arduinoLib: 'Adafruit MPU6050 / I2Cdevlib',
  i2cAddresses: [
    { hex: '0x68', condition: 'AD0 = LOW (default/float)' },
    { hex: '0x69', condition: 'AD0 = HIGH (connect to 3V3)' },
  ],
  notes: [
    'AD0 selects I2C address: LOW=0x68, HIGH=0x69',
    'VCC 2.375V–3.46V (breakout has onboard LDO)',
    'XDA/XCL = auxiliary I2C master port for magnetometer',
    'INT is active HIGH by default (configurable)',
    'Max 400kHz Fast Mode I2C',
    'Gyro full-scale: ±250/500/1000/2000°/s',
  ],
  pins: [
    { id: 'vcc',  label: 'VCC',  signal: 'POWER_3V3', direction: 'in',    side: 'left', position: 0.08 },
    { id: 'gnd',  label: 'GND',  signal: 'GND',       direction: 'power', side: 'left', position: 0.22 },
    { id: 'scl',  label: 'SCL',  signal: 'SCL',       direction: 'in',    side: 'left', position: 0.36 },
    { id: 'sda',  label: 'SDA',  signal: 'SDA',       direction: 'inout', side: 'left', position: 0.50 },
    { id: 'xda',  label: 'XDA',  signal: 'XDA',       direction: 'inout', side: 'right', position: 0.20 },
    { id: 'xcl',  label: 'XCL',  signal: 'XCL',       direction: 'inout', side: 'right', position: 0.36 },
    { id: 'ad0',  label: 'AD0',  signal: 'ADDR',      direction: 'in',    side: 'right', position: 0.55 },
    { id: 'int',  label: 'INT',  signal: 'INT',       direction: 'out',   side: 'right', position: 0.72 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  4. TMP117 High-Accuracy Digital Temperature Sensor
//  Datasheet: TMP117.pdf + USER-MANUAL TMP117.pdf
//  I2C Address: 0x48 (ADD0=GND), 0x49 (ADD0=VCC), 0x4A (ADD0=SDA), 0x4B (ADD0=SCL)
//  Supply: 1.7V–5.5V (breakout: 3.3V or 5V)
//  Accuracy: ±0.1°C (–20°C to 50°C), ±0.3°C max across –40°C to 125°C
// ─────────────────────────────────────────────────────────────────────────────
export const TMP117: ComponentDefinition = {
  typeId: 'tmp117',
  label: 'TMP117 Precision Temp Sensor',
  shortLabel: 'TMP117',
  category: 'Sensor',
  description: '±0.1°C precision. 16-bit resolution (7.8125m°C/LSB). Four I2C addresses via ADD0.',
  voltageRating: 3.3,
  color: '#f59e0b',
  icon: '🌡️',
  width: 180,
  height: 200,
  arduinoLib: 'SparkFun TMP117 / Adafruit TMP117',
  i2cAddresses: [
    { hex: '0x48', condition: 'ADD0 = GND (default)' },
    { hex: '0x49', condition: 'ADD0 = VCC' },
    { hex: '0x4A', condition: 'ADD0 = SDA' },
    { hex: '0x4B', condition: 'ADD0 = SCL' },
  ],
  notes: [
    'ADD0 pin selects one of 4 I2C addresses',
    'Alert/DRDY pin: active HIGH by default (configurable)',
    'One-shot conversion mode for ultra-low power',
    'NIST-traceable accuracy certificate',
    'Max 1MHz I2C (Fast Mode Plus)',
  ],
  pins: [
    { id: 'vplus',  label: 'V+',    signal: 'POWER_3V3', direction: 'in',    side: 'left', position: 0.15 },
    { id: 'gnd',    label: 'GND',   signal: 'GND',       direction: 'power', side: 'left', position: 0.35 },
    { id: 'scl',    label: 'SCL',   signal: 'SCL',       direction: 'in',    side: 'left', position: 0.55 },
    { id: 'sda',    label: 'SDA',   signal: 'SDA',       direction: 'inout', side: 'left', position: 0.72 },
    { id: 'add0',   label: 'ADD0',  signal: 'ADDR',      direction: 'in',    side: 'right', position: 0.35 },
    { id: 'alert',  label: 'ALERT', signal: 'ALERT',     direction: 'out',   side: 'right', position: 0.70 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  5. ENS160 + AHT21 Combo Board (Air Quality & Humidity)
//  Datasheet: ENS160+AHT21.pdf + ENS160AHT21Test.ino
//  ENS160 I2C: 0x53 (ADDR=HIGH) or 0x52 (ADDR=LOW/float)
//  AHT21 I2C: 0x38 (fixed)
//  VDD: 3.3V (ENS160 core: 1.71–1.98V, but breakout has LDO)
// ─────────────────────────────────────────────────────────────────────────────
export const ENS160_AHT21: ComponentDefinition = {
  typeId: 'ens160_aht21',
  label: 'ENS160 + AHT21 Combo',
  shortLabel: 'ENS160+AHT21',
  category: 'Sensor',
  description: 'ENS160: VOC/eCO2/AQI digital air quality. AHT21: ±2%RH, ±0.3°C humidity+temp.',
  voltageRating: 3.3,
  color: '#10b981',
  icon: '🌬️',
  width: 200,
  height: 220,
  arduinoLib: 'DFRobot_ENS160 + DFRobot_AHT20',
  i2cAddresses: [
    { hex: '0x52', condition: 'ENS160: ADDR = LOW/float' },
    { hex: '0x53', condition: 'ENS160: ADDR = HIGH ⚠️ CONFLICT with LTR-390!' },
    { hex: '0x38', condition: 'AHT21: Fixed (always present)' },
  ],
  notes: [
    'ENS160 address: ADDR=LOW→0x52, ADDR=HIGH→0x53',
    '⚠️ ENS160@0x53 CONFLICTS with LTR-390@0x53 — use ADDR=LOW (0x52) when both present',
    'AHT21 address 0x38 is fixed — cannot change',
    'ENS160 needs 3 min warm-up after power-on',
    'ENS160 accuracy improves with AHT21 temp/humidity calibration',
    'TVOC range: 0–65000 ppb; eCO2 range: 400–65000 ppm',
  ],
  pins: [
    { id: 'vdd',  label: 'VDD',  signal: 'POWER_3V3', direction: 'in',    side: 'left', position: 0.10 },
    { id: 'gnd',  label: 'GND',  signal: 'GND',       direction: 'power', side: 'left', position: 0.25 },
    { id: 'scl',  label: 'SCL',  signal: 'SCL',       direction: 'in',    side: 'left', position: 0.45 },
    { id: 'sda',  label: 'SDA',  signal: 'SDA',       direction: 'inout', side: 'left', position: 0.60 },
    { id: 'cs',   label: 'CS',   signal: 'CS',        direction: 'in',    side: 'right', position: 0.30 },
    { id: 'addr', label: 'ADDR', signal: 'ADDR',      direction: 'in',    side: 'right', position: 0.55 },
    { id: 'int',  label: 'INT',  signal: 'INT',       direction: 'out',   side: 'right', position: 0.80 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  6. LTR-390 UV & Ambient Light Sensor
//  Datasheet: LTR390 1.pdf + LTR390schematics.pdf
//  I2C Address: 0x53 (FIXED — cannot change!)
//  VIN: 3.3V–5V (breakout has voltage regulator)
//  Measures: UV index (0–11+) + Ambient light (lux)
// ─────────────────────────────────────────────────────────────────────────────
export const LTR390: ComponentDefinition = {
  typeId: 'ltr390',
  label: 'LTR-390 UV & Ambient Light',
  shortLabel: 'LTR-390',
  category: 'Sensor',
  description: 'Dual-channel UV (315–400nm) + ALS (400–700nm). I2C @ 0x53 (fixed). UV Index + lux output.',
  voltageRating: 3.3,
  color: '#7c3aed',
  icon: '☀️',
  width: 180,
  height: 200,
  arduinoLib: 'Adafruit LTR390 / LTR390UVSensor',
  i2cAddresses: [
    { hex: '0x53', condition: '⚠️ FIXED — conflicts with ENS160 default (0x53)!' },
  ],
  notes: [
    '⚠️ Address 0x53 is HARDWIRED — cannot be changed',
    '⚠️ Conflicts with ENS160 @ 0x53 — MUST set ENS160 ADDR pin LOW (→ 0x52)',
    'INT pin is active LOW, open-drain',
    'UV sensitivity: 0.004 lux/count; ALS: 0.2 lux/count (gain=1)',
    'Two measurement modes: ALS mode and UV mode (not simultaneous)',
    'Max 400kHz I2C (Fast Mode)',
  ],
  pins: [
    { id: 'vin',  label: 'VIN',  signal: 'POWER_3V3', direction: 'in',    side: 'left', position: 0.15 },
    { id: 'gnd',  label: 'GND',  signal: 'GND',       direction: 'power', side: 'left', position: 0.35 },
    { id: 'scl',  label: 'SCL',  signal: 'SCL',       direction: 'in',    side: 'left', position: 0.55 },
    { id: 'sda',  label: 'SDA',  signal: 'SDA',       direction: 'inout', side: 'left', position: 0.72 },
    { id: 'int',  label: 'INT',  signal: 'INT',       direction: 'out',   side: 'right', position: 0.50 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  7. 3.7V LiPo Battery (200mAh Single-Cell)
//  Datasheet: LiPo R177586.pdf
//  Connects to XIAO BLE BAT+ and BAT- pads
//  XIAO has onboard MCP73831 LiPo charger + over-discharge protection
// ─────────────────────────────────────────────────────────────────────────────
export const LIPO_BATTERY: ComponentDefinition = {
  typeId: 'lipo_battery',
  label: '3.7V 200mAh LiPo Battery',
  shortLabel: 'LiPo 200mAh',
  category: 'Power',
  description: 'Single-cell 3.7V nominal (4.2V max) LiPo. Connects to XIAO BAT+/BAT-. 200mAh capacity.',
  voltageRating: 3.3,
  color: '#f97316',
  icon: '🔋',
  width: 160,
  height: 140,
  arduinoLib: '',
  i2cAddresses: [],
  notes: [
    'Nominal: 3.7V | Fully charged: 4.2V | Cut-off: 3.0V',
    'XIAO BLE has onboard MCP73831 charger (100mA charge rate)',
    'Over-discharge protection built into XIAO',
    'JST 1.25mm connector — check polarity before connecting!',
    'Estimated runtime: ~3–6 hours for full sensor stack',
  ],
  pins: [
    { id: 'bat_pos', label: 'BAT+', signal: 'BAT_POS', direction: 'out', side: 'right', position: 0.35 },
    { id: 'bat_neg', label: 'BAT-', signal: 'BAT_NEG', direction: 'out', side: 'right', position: 0.65 },
  ],
}

// ─────────────────────────────────────────────────────────────────────────────
//  8. Passive Elements
// ─────────────────────────────────────────────────────────────────────────────
export const RESISTOR_4K7: ComponentDefinition = {
  typeId: 'resistor_4k7',
  label: '4.7kΩ Pull-up Resistor',
  shortLabel: '4.7kΩ',
  category: 'Passive',
  description: 'Standard 4.7kΩ pull-up for I2C SDA/SCL lines (recommended for Fast Mode 400kHz).',
  voltageRating: 'both',
  color: '#6b7280',
  icon: '⟿',
  width: 140,
  height: 100,
  i2cAddresses: [],
  notes: ['4.7kΩ is optimal for 400kHz I2C Fast Mode', 'Connect between 3V3 rail and SDA or SCL'],
  pins: [
    { id: 'p1', label: 'Pin1', signal: 'NC', direction: 'inout', side: 'left',  position: 0.5 },
    { id: 'p2', label: 'Pin2', signal: 'NC', direction: 'inout', side: 'right', position: 0.5 },
  ],
}

const RESISTOR_10K: ComponentDefinition = {
  typeId: 'resistor_10k',
  label: '10kΩ Resistor',
  shortLabel: '10kΩ',
  category: 'Passive',
  description: '10kΩ resistor — for GPIO pull-ups, voltage dividers, or address pin biasing.',
  voltageRating: 'both',
  color: '#6b7280',
  icon: '⟿',
  width: 140,
  height: 100,
  i2cAddresses: [],
  notes: ['Suitable for GPIO pull-up/pull-down or address pin biasing'],
  pins: [
    { id: 'p1', label: 'Pin1', signal: 'NC', direction: 'inout', side: 'left',  position: 0.5 },
    { id: 'p2', label: 'Pin2', signal: 'NC', direction: 'inout', side: 'right', position: 0.5 },
  ],
}

const CAP_100NF: ComponentDefinition = {
  typeId: 'cap_100nf',
  label: '0.1µF Decoupling Cap',
  shortLabel: '0.1µF',
  category: 'Passive',
  description: '100nF ceramic decoupling capacitor — place close to VCC pin of each IC.',
  voltageRating: 'both',
  color: '#6b7280',
  icon: '⊣⊢',
  width: 140,
  height: 100,
  i2cAddresses: [],
  notes: ['Place as close to IC VCC pin as possible', 'Filters high-frequency noise'],
  pins: [
    { id: 'p1', label: 'VCC', signal: 'POWER_3V3', direction: 'in',  side: 'left',  position: 0.5 },
    { id: 'p2', label: 'GND', signal: 'GND',       direction: 'power', side: 'right', position: 0.5 },
  ],
}

const CAP_10UF: ComponentDefinition = {
  typeId: 'cap_10uf',
  label: '10µF Bulk Capacitor',
  shortLabel: '10µF',
  category: 'Passive',
  description: '10µF electrolytic/tantalum bulk capacitor — on 3V3 power rail for stability.',
  voltageRating: 'both',
  color: '#6b7280',
  icon: '⊣⊢',
  width: 140,
  height: 100,
  i2cAddresses: [],
  notes: ['Place on 3V3 rail near power entry', 'Filters low-frequency noise and voltage droop'],
  pins: [
    { id: 'p1', label: 'VCC', signal: 'POWER_3V3', direction: 'in',  side: 'left',  position: 0.5 },
    { id: 'p2', label: 'GND', signal: 'GND',       direction: 'power', side: 'right', position: 0.5 },
  ],
}

// ─── Master component library ─────────────────────────────────────────────────
export const COMPONENT_LIBRARY: ComponentDefinition[] = [
  XIAO_BLE,
  MAX30102,
  MPU6050,
  TMP117,
  ENS160_AHT21,
  LTR390,
  LIPO_BATTERY,
  RESISTOR_4K7,
  RESISTOR_10K,
  CAP_100NF,
  CAP_10UF,
]

// ─── Category display config ──────────────────────────────────────────────────
export const CATEGORY_CONFIG: Record<string, { color: string; icon: string; order: number }> = {
  MCU:       { color: '#6366f1', icon: '🧠', order: 0 },
  Sensor:    { color: '#06b6d4', icon: '📡', order: 1 },
  Power:     { color: '#f97316', icon: '⚡', order: 2 },
  Passive:   { color: '#6b7280', icon: '🔧', order: 3 },
  Connector: { color: '#14b8a6', icon: '🔌', order: 4 },
}

// ─── Compatible signal connections (source → allowed targets) ────────────────
export const COMPATIBLE_SIGNALS: Record<string, string[]> = {
  POWER_3V3: ['POWER_3V3'],
  GND:       ['GND', 'BAT_NEG'],
  SDA:       ['SDA'],
  SCL:       ['SCL'],
  GPIO:      ['GPIO', 'INT', 'ALERT', 'ADDR', 'CS'],
  INT:       ['GPIO', 'INT'],
  BAT_POS:   ['BAT_POS'],
  BAT_NEG:   ['BAT_NEG', 'GND'],
  ADDR:      ['GPIO', 'GND', 'POWER_3V3', 'SDA', 'SCL'],
  XDA:       ['XDA', 'SDA'],
  XCL:       ['XCL', 'SCL'],
  CS:        ['GPIO', 'CS'],
  ALERT:     ['GPIO', 'ALERT', 'INT'],
  ANALOG:    ['ANALOG', 'GPIO'],
  NC:        ['NC', 'GPIO', 'POWER_3V3', 'GND', 'SDA', 'SCL', 'INT', 'ADDR', 'ALERT'],
}
