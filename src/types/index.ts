// ─────────────────────────────────────────────
//  Shared TypeScript Types
// ─────────────────────────────────────────────

export type SignalType =
  | 'POWER_3V3'
  | 'POWER_5V'
  | 'GND'
  | 'SDA'
  | 'SCL'
  | 'GPIO'
  | 'INT'
  | 'BAT_POS'
  | 'BAT_NEG'
  | 'ADDR'
  | 'XDA'
  | 'XCL'
  | 'CS'
  | 'ALERT'
  | 'ANALOG'
  | 'NC'

export type PinDirection = 'in' | 'out' | 'inout' | 'power'

export interface PinDefinition {
  id: string           // unique within component, e.g. "vcc", "sda"
  label: string        // display label, e.g. "VIN", "SDA"
  signal: SignalType
  direction: PinDirection
  side: 'left' | 'right'   // which side of the node to render
  position: number          // 0..1 relative position along the side
}

export type ComponentCategory = 'MCU' | 'Sensor' | 'Power' | 'Passive' | 'Connector'

export interface I2CAddress {
  hex: string          // e.g. "0x57"
  condition?: string   // e.g. "AD0=LOW" — optional condition
}

export interface ComponentDefinition {
  typeId: string
  label: string
  shortLabel: string
  category: ComponentCategory
  description: string
  voltageRating: 3.3 | 5.0 | 'both'
  pins: PinDefinition[]
  i2cAddresses: I2CAddress[]
  arduinoLib?: string
  color: string         // tailwind-compatible hex accent color
  icon: string          // emoji or icon name
  width: number
  height: number
  notes?: string[]
}

// ─────────────────────────────────────────────
//  React Flow node/edge data types
// ─────────────────────────────────────────────

export interface ComponentNodeData {
  typeId: string
  label: string
  instanceId: string
  componentDef: ComponentDefinition
  drcErrors: string[]
  drcWarnings: string[]
  selectedI2CAddress?: string   // for MPU-6050 AD0 resolved address
}

export interface PassiveNodeData {
  typeId: string
  label: string
  instanceId: string
  value: string       // e.g. "4.7kΩ" or "0.1µF"
  drcErrors: string[]
  drcWarnings: string[]
}

export interface SignalEdgeData {
  signal: SignalType
  label?: string
  animated?: boolean
}

// ─────────────────────────────────────────────
//  DRC (Design Rule Check) types
// ─────────────────────────────────────────────

export type DRCSeverity = 'error' | 'warning' | 'info' | 'CRITICAL_ERROR'

export interface DRCResult {
  id: string
  severity: DRCSeverity
  message: string
  detail?: string
  affectedNodeIds: string[]
  affectedEdgeIds: string[]
  suggestion?: string
}

// ─────────────────────────────────────────────
//  End of Types
// ─────────────────────────────────────────────

export interface BOMEntry {
  reference: string
  value: string
  description: string
  package: string
  quantity: number
  supplier: string
  partNumber: string
  notes: string
}