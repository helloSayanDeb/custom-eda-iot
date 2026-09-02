/**
 * ═══════════════════════════════════════════════════════════════════════════════
 *  IoT Schematic Canvas — Automated Test Suite
 *  Author  : Principal QA Automation Engineer
 *  Target  : Vitest (node environment — no DOM required)
 *  Modules : src/validation/drc.ts  |  src/export/exportArduino.ts
 *            src/export/exportBOM.ts  |  src/export/exportJSON.ts
 *
 *  Coverage:
 *   ┌─ Block A: DRC Engine (5 rules)
 *   │   A1 — I2C address collision 0x53 (ENS160 + LTR-390)
 *   │   A2 — Battery short-circuit / polarity reversal
 *   │   A3 — Overvoltage: 5V rail wired to 3.3V sensor
 *   │   A4 — Incomplete I2C bus (SDA only, SCL open)
 *   │   A5 — Missing pull-up resistors on I2C bus
 *   └─ Block B: Exporter Engine (3 exporters × N assertions)
 *       B1 — Arduino .ino sketch syntactic verification
 *       B2 — CSV BOM structure + all 8 hardware modules present
 *       B3 — Netlist CSV structure verification
 *       B4 — JSON export schema verification
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, beforeAll } from 'vitest'
import type { Node, Edge } from '@xyflow/react'

// Modules under test
import { runDRC, buildI2CBusReport } from '../validation/drc'
import { generateArduinoSketch }     from '../export/exportArduino'
import { generateCSVBOM, generateNetlist } from '../export/exportBOM'
import { exportJSON }                from '../export/exportJSON'

// Hardware definitions (ground-truth reference data)
import {
  XIAO_BLE, MAX30102, MPU6050, TMP117,
  ENS160_AHT21, LTR390, LIPO_BATTERY,
  RESISTOR_4K7, COMPONENT_LIBRARY,
} from '../data/components'
import type { ComponentNodeData } from '../types'

// ─────────────────────────────────────────────────────────────────────────────
//  Test Node/Edge Builder Helpers
//  Mirrors exactly how App.tsx creates nodes so the DRC engine sees the same
//  data shape it would see at runtime.
// ─────────────────────────────────────────────────────────────────────────────

/** Build a minimal React Flow Node from a ComponentDefinition */
function makeNode(id: string, typeId: string): Node {
  const def = COMPONENT_LIBRARY.find(c => c.typeId === typeId)
  if (!def) throw new Error(`Unknown typeId: ${typeId}`)
  return {
    id,
    type: def.category === 'Passive' ? 'passive' : 'component',
    position: { x: 0, y: 0 },
    data: {
      typeId: def.typeId,
      label: def.shortLabel,
      instanceId: `${typeId}_${id}`,
      componentDef: def,
      drcErrors: [],
      drcWarnings: [],
    } satisfies ComponentNodeData as unknown as Record<string, unknown>,
  }
}

/**
 * Build a React Flow Edge that connects two specific pins.
 * Handle format expected by DRC engine: "{nodeId}__{pinId}"
 */
function makeEdge(
  id: string,
  sourceNodeId: string, sourcePinId: string,
  targetNodeId: string, targetPinId: string,
): Edge {
  return {
    id,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: `${sourceNodeId}__${sourcePinId}`,
    targetHandle: `${targetNodeId}__${targetPinId}`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  SHARED FIXTURE: Healthy 5-Sensor Canvas
//  XIAO BLE + MAX30102 + MPU-6050 + TMP117 + ENS160+AHT21 (addr resolved)
//  + 4.7kΩ pull-up resistor. LTR-390 deliberately omitted to avoid 0x53 clash.
// ─────────────────────────────────────────────────────────────────────────────
let healthyNodes: Node[]
let healthyEdges: Edge[]

beforeAll(() => {
  const xiao   = makeNode('n_xiao',   'xiao_ble_nrf52840')
  const max     = makeNode('n_max',    'max30102')
  const mpu     = makeNode('n_mpu',    'mpu6050')
  const tmp     = makeNode('n_tmp',    'tmp117')
  const ens     = makeNode('n_ens',    'ens160_aht21')
  const pullup  = makeNode('n_r1',     'resistor_4k7')
  const lipo    = makeNode('n_bat',    'lipo_battery')

  healthyNodes = [xiao, max, mpu, tmp, ens, pullup, lipo]

  healthyEdges = [
    // ─── Power rails ─────────────────────────────────────────────────────────
    makeEdge('e_3v3_max', 'n_xiao', 'vcc_3v3',  'n_max', 'vin'),
    makeEdge('e_3v3_mpu', 'n_xiao', 'vcc_3v3',  'n_mpu', 'vcc'),
    makeEdge('e_3v3_tmp', 'n_xiao', 'vcc_3v3',  'n_tmp', 'vplus'),
    makeEdge('e_3v3_ens', 'n_xiao', 'vcc_3v3',  'n_ens', 'vdd'),

    // ─── GND rails ───────────────────────────────────────────────────────────
    makeEdge('e_gnd_max', 'n_xiao', 'gnd1',     'n_max', 'gnd'),
    makeEdge('e_gnd_mpu', 'n_xiao', 'gnd1',     'n_mpu', 'gnd'),
    makeEdge('e_gnd_tmp', 'n_xiao', 'gnd1',     'n_tmp', 'gnd'),
    makeEdge('e_gnd_ens', 'n_xiao', 'gnd1',     'n_ens', 'gnd'),

    // ─── I2C SDA bus (XIAO D4/SDA → each sensor SDA) ────────────────────────
    makeEdge('e_sda_max', 'n_xiao', 'd4_sda',   'n_max', 'sda'),
    makeEdge('e_sda_mpu', 'n_xiao', 'd4_sda',   'n_mpu', 'sda'),
    makeEdge('e_sda_tmp', 'n_xiao', 'd4_sda',   'n_tmp', 'sda'),
    makeEdge('e_sda_ens', 'n_xiao', 'd4_sda',   'n_ens', 'sda'),

    // ─── I2C SCL bus (XIAO D5/SCL → each sensor SCL) ────────────────────────
    makeEdge('e_scl_max', 'n_xiao', 'd5_scl',   'n_max', 'scl'),
    makeEdge('e_scl_mpu', 'n_xiao', 'd5_scl',   'n_mpu', 'scl'),
    makeEdge('e_scl_tmp', 'n_xiao', 'd5_scl',   'n_tmp', 'scl'),
    makeEdge('e_scl_ens', 'n_xiao', 'd5_scl',   'n_ens', 'scl'),

    // ─── Battery ─────────────────────────────────────────────────────────────
    makeEdge('e_bat_pos', 'n_bat', 'bat_pos',   'n_xiao', 'bat_pos'),
    makeEdge('e_bat_neg', 'n_bat', 'bat_neg',   'n_xiao', 'bat_neg'),
  ]
})

// ═══════════════════════════════════════════════════════════════════════════════
//  BLOCK A — DRC Engine Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('Block A — DRC Engine', () => {

  // ───────────────────────────────────────────────────────────────────────────
  //  A1: I2C Address Collision 0x53  (ENS160 default vs LTR-390 fixed)
  // ───────────────────────────────────────────────────────────────────────────
  describe('A1 — I2C Address Collision (ENS160 + LTR-390 @ 0x53)', () => {
    /**
     * Setup: XIAO + ENS160 (ADDR pin left floating → 0x53) + LTR-390 (0x53 fixed).
     * Both sensors wired to the same SDA/SCL lines WITHOUT touching the ADDR pin.
     * Expected: DRC must fire an address-conflict error AND an ENS160-ADDR warning.
     */
    let colNodes: Node[]
    let colEdges: Edge[]
    let results: ReturnType<typeof runDRC>

    beforeAll(() => {
      const xiao = makeNode('c_xiao',  'xiao_ble_nrf52840')
      const ens  = makeNode('c_ens',   'ens160_aht21')
      const ltr  = makeNode('c_ltr',   'ltr390')

      colNodes = [xiao, ens, ltr]

      // Wire both sensors to the same I2C bus — ADDR pin intentionally left open
      colEdges = [
        makeEdge('c_sda_ens',  'c_xiao', 'd4_sda', 'c_ens', 'sda'),
        makeEdge('c_scl_ens',  'c_xiao', 'd5_scl', 'c_ens', 'scl'),
        makeEdge('c_sda_ltr',  'c_xiao', 'd4_sda', 'c_ltr', 'sda'),
        makeEdge('c_scl_ltr',  'c_xiao', 'd5_scl', 'c_ltr', 'scl'),
      ]

      results = runDRC(colNodes, colEdges)
    })

    it('should return at least one DRC result', () => {
      expect(results.length).toBeGreaterThan(0)
    })

    it('should flag an ERROR-severity address conflict at 0x53', () => {
      const conflictError = results.find(
        r => r.severity === 'error' && r.message.includes('0x53')
      )
      expect(conflictError).toBeDefined()
      expect(conflictError!.severity).toBe('error')
    })

    it('should name both ENS160+AHT21 and LTR-390 in the conflict message', () => {
      const conflictError = results.find(
        r => r.severity === 'error' && r.message.includes('0x53')
      )
      expect(conflictError!.message).toMatch(/ENS160/)
      expect(conflictError!.message).toMatch(/LTR/)
    })

    it('suggestion must contain "pull ADDR pin LOW" mitigation text', () => {
      const conflictError = results.find(
        r => r.severity === 'error' && r.message.includes('0x53')
      )
      // The DRC suggestion: "Set ENS160 ADDR pin LOW (pull to GND) to use address 0x52 instead."
      expect(conflictError!.suggestion).toMatch(/ADDR\s+pin\s+LOW|pull\s+to\s+GND|pull\s+ADDR\s+pin\s+LOW/i)
    })

    it('should affect both the ENS160 and LTR-390 node IDs', () => {
      const conflictError = results.find(
        r => r.severity === 'error' && r.message.includes('0x53')
      )
      expect(conflictError!.affectedNodeIds).toContain('c_ens')
      expect(conflictError!.affectedNodeIds).toContain('c_ltr')
    })

    it('should also emit a WARNING about ENS160 ADDR pin being unconnected', () => {
      const addrWarn = results.find(
        r => r.severity === 'warning' && r.message.includes('ADDR pin unconnected')
      )
      expect(addrWarn).toBeDefined()
    })

    it('should emit an INFO about LTR-390 fixed address requiring ENS160 reconfiguration', () => {
      const infoResult = results.find(
        r => r.severity === 'info' && r.message.includes('0x53') && r.message.includes('ENS160')
      )
      expect(infoResult).toBeDefined()
    })

    it('buildI2CBusReport should mark 0x53 entries as conflicts', () => {
      const busReport = buildI2CBusReport(colNodes, colEdges)
      const conflicted = busReport.filter(e => e.hex === '0x53' && e.isConflict)
      expect(conflicted.length).toBeGreaterThanOrEqual(2)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A2: Battery Short-Circuit — BAT+ wired directly to BAT- / GND
  // ───────────────────────────────────────────────────────────────────────────
  describe('A2 — Battery Short-Circuit / Polarity Reversal', () => {
    /**
     * Setup: LIPO BAT+ connected to XIAO BAT- (reversed polarity)
     * Expected: DRC must flag a high-severity (error) short-circuit message.
     */
    it('should flag ERROR when BAT+ is connected to BAT-', () => {
      const bat  = makeNode('b_bat',  'lipo_battery')
      const xiao = makeNode('b_xiao', 'xiao_ble_nrf52840')

      const nodes: Node[] = [bat, xiao]
      // Wire BAT+ → BAT- (polarity reversed — catastrophic short)
      const edges: Edge[] = [
        makeEdge('b_short', 'b_bat', 'bat_pos', 'b_xiao', 'bat_neg'),
      ]

      const results = runDRC(nodes, edges)
      const shortCircuit = results.find(
        r => r.severity === 'CRITICAL_ERROR' &&
             (r.message.includes('short circuit') || r.message.includes('Reverse Bias') || r.message.includes('BAT+'))
      )
      expect(shortCircuit).toBeDefined()
      expect(shortCircuit!.severity).toBe('CRITICAL_ERROR')
    })

    it('should contain "fire" or "destroy" in the detail — indicating criticality', () => {
      const bat  = makeNode('b2_bat',  'lipo_battery')
      const xiao = makeNode('b2_xiao', 'xiao_ble_nrf52840')
      const edges: Edge[] = [
        makeEdge('b2_short', 'b2_bat', 'bat_pos', 'b2_xiao', 'bat_neg'),
      ]
      const results = runDRC([bat, xiao], edges)
      const shortCircuit = results.find(r => r.message.includes('BAT+'))
      expect(shortCircuit!.detail).toMatch(/destroy|fire/i)
    })

    it('should identify the specific edge as the affected edge', () => {
      const bat  = makeNode('b3_bat',  'lipo_battery')
      const xiao = makeNode('b3_xiao', 'xiao_ble_nrf52840')
      const edges: Edge[] = [
        makeEdge('b3_short_edge', 'b3_bat', 'bat_pos', 'b3_xiao', 'bat_neg'),
      ]
      const results = runDRC([bat, xiao], edges)
      const shortCircuit = results.find(r => r.message.includes('BAT+'))
      expect(shortCircuit!.affectedEdgeIds).toContain('b3_short_edge')
    })

    it('should NOT flag a short when BAT+ → XIAO BAT+ (correct polarity)', () => {
      const bat  = makeNode('b4_bat',  'lipo_battery')
      const xiao = makeNode('b4_xiao', 'xiao_ble_nrf52840')
      const edges: Edge[] = [
        makeEdge('b4_correct', 'b4_bat', 'bat_pos', 'b4_xiao', 'bat_pos'),
      ]
      const results = runDRC([bat, xiao], edges)
      const shortCircuit = results.find(r => r.message.includes('short circuit'))
      // No short circuit with correct polarity
      expect(shortCircuit).toBeUndefined()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A3: Overvoltage — 5V supply wired to 3.3V-only sensor
  // ───────────────────────────────────────────────────────────────────────────
  describe('A3 — Overvoltage: 5V rail → 3.3V-only sensor', () => {
    /**
     * Setup: Create a synthetic 5V source node by embedding POWER_5V signal
     * on the XIAO VUSB pin (P0.14), then wire it to MAX30102 VIN which
     * expects 3.3V max according to its datasheet.
     * Expected: DRC flags a 5V → 3.3V overvoltage error.
     */
    it('should flag ERROR when XIAO VUSB(5V) is connected to MAX30102 VIN', () => {
      const xiao = makeNode('v_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('v_max',  'max30102')

      const nodes: Node[] = [xiao, max]
      // XIAO VUSB pin has signal POWER_5V — wiring it to MAX30102 VIN (POWER_3V3)
      const edges: Edge[] = [
        makeEdge('v_overvoltage', 'v_xiao', 'vusb', 'v_max', 'vin'),
      ]

      const results = runDRC(nodes, edges)
      const voltageError = results.find(
        r => r.severity === 'error' && r.message.includes('5V')
      )
      expect(voltageError).toBeDefined()
      expect(voltageError!.severity).toBe('error')
    })

    it('overvoltage error message must name the damaged component or signal problem', () => {
      const xiao = makeNode('v2_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('v2_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('v2_ov', 'v2_xiao', 'vusb', 'v2_max', 'vin'),
      ]
      const results = runDRC([xiao, max], edges)
      // Connecting VUSB(POWER_5V) → VIN(POWER_3V3) triggers either:
      //  - Rule 1 signal-mismatch (POWER_5V → POWER_3V3) OR
      //  - Rule 2 explicit overvoltage
      // Both prove the wiring is caught. At minimum an error exists.
      const voltageError = results.find(
        r => r.severity === 'error' &&
             (r.message.includes('5V') || r.message.includes('mismatch'))
      )
      expect(voltageError).toBeDefined()
      // The message must contain the signal name or component short label
      expect(voltageError!.message).toMatch(/5V|POWER_5V|Power|mismatch/i)
    })

    it('suggestion must mention the signal type problem or safe voltage fix', () => {
      const xiao = makeNode('v3_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('v3_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('v3_ov', 'v3_xiao', 'vusb', 'v3_max', 'vin'),
      ]
      const results = runDRC([xiao, max], edges)
      // Either a signal-mismatch error (Rule 1) or explicit overvoltage error (Rule 2)
      const anyError = results.find(
        r => r.severity === 'error' &&
             (r.message.includes('5V') || r.message.includes('mismatch'))
      )
      expect(anyError).toBeDefined()
      // Suggestion must exist (non-empty)
      expect(anyError!.suggestion).toBeTruthy()
      expect(anyError!.suggestion!.length).toBeGreaterThan(10)
    })

    it('should NOT flag overvoltage when 3V3 rail is connected to MAX30102', () => {
      const xiao = makeNode('v4_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('v4_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('v4_ok', 'v4_xiao', 'vcc_3v3', 'v4_max', 'vin'),
      ]
      const results = runDRC([xiao, max], edges)
      const voltageError = results.find(r => r.severity === 'error' && r.message.includes('5V'))
      expect(voltageError).toBeUndefined()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A4: Incomplete I2C Bus — SDA connected, SCL left open
  // ───────────────────────────────────────────────────────────────────────────
  describe('A4 — Incomplete I2C Bus (SDA only, SCL open)', () => {
    /**
     * Setup: XIAO SDA → MAX30102 SDA but NO SCL edge.
     * The MAX30102 is "connected" (has ≥1 edge) so DRC should flag it.
     * Expected: DRC emits a WARNING about incomplete I2C connection.
     */
    it('should emit WARNING for sensor with SDA but no SCL', () => {
      const xiao = makeNode('p_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('p_max',  'max30102')

      const nodes: Node[] = [xiao, max]
      // Only SDA — no SCL edge
      const edges: Edge[] = [
        makeEdge('p_sda_only', 'p_xiao', 'd4_sda', 'p_max', 'sda'),
      ]

      const results = runDRC(nodes, edges)
      const incompleteWarn = results.find(
        r => r.severity === 'warning' && r.message.includes('Incomplete I2C')
      )
      expect(incompleteWarn).toBeDefined()
    })

    it('warning should identify the specific sensor node', () => {
      const xiao = makeNode('p2_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('p2_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('p2_sda_only', 'p2_xiao', 'd4_sda', 'p2_max', 'sda'),
      ]
      const results = runDRC([xiao, max], edges)
      const incompleteWarn = results.find(
        r => r.severity === 'warning' && r.message.includes('MAX30102')
      )
      expect(incompleteWarn).toBeDefined()
      expect(incompleteWarn!.affectedNodeIds).toContain('p2_max')
    })

    it('warning suggestion should instruct to connect SCL', () => {
      const xiao = makeNode('p3_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('p3_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('p3_sda_only', 'p3_xiao', 'd4_sda', 'p3_max', 'sda'),
      ]
      const results = runDRC([xiao, max], edges)
      const incompleteWarn = results.find(r => r.message.includes('Incomplete I2C'))
      expect(incompleteWarn!.suggestion).toMatch(/SCL/i)
    })

    it('should NOT emit incomplete I2C warning when both SDA and SCL are connected', () => {
      const xiao = makeNode('p4_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('p4_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('p4_sda', 'p4_xiao', 'd4_sda', 'p4_max', 'sda'),
        makeEdge('p4_scl', 'p4_xiao', 'd5_scl', 'p4_max', 'scl'),
      ]
      const results = runDRC([xiao, max], edges)
      const incompleteWarn = results.find(r => r.message.includes('Incomplete I2C'))
      expect(incompleteWarn).toBeUndefined()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A5: Missing Pull-Up Resistors on I2C Bus
  // ───────────────────────────────────────────────────────────────────────────
  describe('A5 — Missing I2C Pull-Up Resistors', () => {
    /**
     * Setup: XIAO + multiple sensors fully wired via SDA/SCL, but NO resistor node.
     * Expected: DRC emits a WARNING about missing pull-ups.
     */
    it('should emit WARNING when I2C bus is wired but no pull-up resistor present', () => {
      const xiao = makeNode('r_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('r_max',  'max30102')
      const tmp  = makeNode('r_tmp',  'tmp117')

      const nodes: Node[] = [xiao, max, tmp] // ← no resistor node!
      const edges: Edge[] = [
        makeEdge('r_sda_max', 'r_xiao', 'd4_sda', 'r_max', 'sda'),
        makeEdge('r_scl_max', 'r_xiao', 'd5_scl', 'r_max', 'scl'),
        makeEdge('r_sda_tmp', 'r_xiao', 'd4_sda', 'r_tmp', 'sda'),
        makeEdge('r_scl_tmp', 'r_xiao', 'd5_scl', 'r_tmp', 'scl'),
      ]

      const results = runDRC(nodes, edges)
      const pullupWarn = results.find(
        r => r.severity === 'warning' && r.message.includes('pull-up')
      )
      expect(pullupWarn).toBeDefined()
    })

    it('pull-up warning suggestion must recommend 4.7kΩ resistors', () => {
      const xiao = makeNode('r2_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('r2_max',  'max30102')
      const edges: Edge[] = [
        makeEdge('r2_sda', 'r2_xiao', 'd4_sda', 'r2_max', 'sda'),
        makeEdge('r2_scl', 'r2_xiao', 'd5_scl', 'r2_max', 'scl'),
      ]
      const results = runDRC([xiao, max], edges)
      const pullupWarn = results.find(r => r.message.includes('pull-up'))
      expect(pullupWarn!.suggestion).toMatch(/4\.7\s*k[Ωω]|4700/i)
    })

    it('should NOT emit pull-up warning when a 4.7kΩ resistor node is on the canvas', () => {
      const xiao   = makeNode('r3_xiao', 'xiao_ble_nrf52840')
      const max    = makeNode('r3_max',  'max30102')
      const pullup = makeNode('r3_r1',   'resistor_4k7')   // ← resistor present!

      const nodes: Node[] = [xiao, max, pullup]
      const edges: Edge[] = [
        makeEdge('r3_sda', 'r3_xiao', 'd4_sda', 'r3_max', 'sda'),
        makeEdge('r3_scl', 'r3_xiao', 'd5_scl', 'r3_max', 'scl'),
      ]

      const results = runDRC(nodes, edges)
      const pullupWarn = results.find(r => r.message.includes('pull-up'))
      expect(pullupWarn).toBeUndefined()
    })

    it('should NOT emit pull-up warning when no I2C edges are present at all', () => {
      const xiao = makeNode('r4_xiao', 'xiao_ble_nrf52840')
      // Sensor is on the canvas but completely unwired
      const max  = makeNode('r4_max',  'max30102')
      const results = runDRC([xiao, max], [])
      const pullupWarn = results.find(r => r.message.includes('pull-up'))
      expect(pullupWarn).toBeUndefined()
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A6: Healthy canvas should produce ZERO errors and ZERO warnings
  // ───────────────────────────────────────────────────────────────────────────
  describe('A6 — Golden-Path: Healthy Canvas Is Clean', () => {
    it('healthy 5-sensor canvas should have zero DRC errors', () => {
      const results = runDRC(healthyNodes, healthyEdges)
      const errors = results.filter(r => r.severity === 'error')
      expect(errors).toHaveLength(0)
    })

    it('healthy canvas should have zero DRC warnings', () => {
      const results = runDRC(healthyNodes, healthyEdges)
      const warnings = results.filter(r => r.severity === 'warning')
      expect(warnings).toHaveLength(0)
    })

    it('empty canvas (no nodes, no edges) should return zero DRC results', () => {
      const results = runDRC([], [])
      expect(results).toHaveLength(0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  A7: Signal Mismatch — connecting wrong signal types (e.g. SDA → GND)
  // ───────────────────────────────────────────────────────────────────────────
  describe('A7 — Signal Type Mismatch (SDA → GND)', () => {
    it('should flag ERROR when SDA pin is wired to GND pin', () => {
      const xiao = makeNode('sm_xiao', 'xiao_ble_nrf52840')
      const max  = makeNode('sm_max',  'max30102')

      // Wire XIAO SDA → MAX30102 GND (nonsensical connection)
      const edges: Edge[] = [
        makeEdge('sm_wrong', 'sm_xiao', 'd4_sda', 'sm_max', 'gnd'),
      ]

      const results = runDRC([xiao, max], edges)
      const mismatch = results.find(
        r => r.severity === 'error' && r.message.includes('mismatch')
      )
      expect(mismatch).toBeDefined()
      expect(mismatch!.message).toMatch(/SDA.*GND|I2C SDA.*Ground/i)
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  BLOCK B — Exporter Engine Syntactical Verification
// ═══════════════════════════════════════════════════════════════════════════════
describe('Block B — Exporter Engine', () => {

  // ───────────────────────────────────────────────────────────────────────────
  //  B1: Arduino .ino Sketch Generator
  // ───────────────────────────────────────────────────────────────────────────
  describe('B1 — Arduino .ino Sketch Generator', () => {
    let sketch: string

    beforeAll(() => {
      sketch = generateArduinoSketch(healthyNodes, healthyEdges)
    })

    it('should return a non-empty string', () => {
      expect(typeof sketch).toBe('string')
      expect(sketch.length).toBeGreaterThan(200)
    })

    it('must include Wire.h include directive', () => {
      expect(sketch).toContain('#include <Wire.h>')
    })

    it('must include Wire.begin with SDA and SCL constant arguments', () => {
      // The sketch defines I2C_SDA=4, I2C_SCL=5 and calls Wire.begin(I2C_SDA, I2C_SCL)
      expect(sketch).toMatch(/Wire\.begin\(I2C_SDA,\s*I2C_SCL\)/)
    })

    it('must define SDA pin constant for D4 (nRF52840 I2C SDA)', () => {
      expect(sketch).toMatch(/#define\s+I2C_SDA\s+4/)
    })

    it('must define SCL pin constant for D5 (nRF52840 I2C SCL)', () => {
      expect(sketch).toMatch(/#define\s+I2C_SCL\s+5/)
    })

    it('must include MAX30102 address (0x57)', () => {
      expect(sketch).toMatch(/0x57/)
    })

    it('must include MPU-6050 address (0x68)', () => {
      expect(sketch).toMatch(/0x68/)
    })

    it('must include TMP117 address (0x48)', () => {
      expect(sketch).toMatch(/0x48/)
    })

    it('must include AHT21 address (0x38) — part of ENS160+AHT21 combo', () => {
      expect(sketch).toMatch(/0x38/)
    })

    it('must include Wire.setClock for 400kHz Fast Mode', () => {
      expect(sketch).toMatch(/Wire\.setClock\(400000\)/)
    })

    it('must include the I2C scanner function definition', () => {
      expect(sketch).toContain('scanI2CBus')
    })

    it('must include a loop() function', () => {
      expect(sketch).toContain('void loop()')
    })

    it('must include a setup() function', () => {
      expect(sketch).toContain('void setup()')
    })

    it('must include MAX30102 library include when MAX30102 is on canvas', () => {
      expect(sketch).toMatch(/MAX30105\.h|MAX3010x/i)
    })

    it('must include MPU6050 library include', () => {
      expect(sketch).toMatch(/Adafruit_MPU6050\.h/i)
    })

    it('must include TMP117 library include', () => {
      expect(sketch).toMatch(/TMP117\.h|SparkFun_TMP117/i)
    })

    it('must include ENS160 + AHT21 library includes', () => {
      expect(sketch).toMatch(/DFRobot_ENS160/)
      expect(sketch).toMatch(/DFRobot_AHT20/)
    })

    it('should NOT contain Wire.begin when only passive components are on canvas', () => {
      const passiveOnly = [makeNode('r_only', 'resistor_4k7')]
      const emptySketch = generateArduinoSketch(passiveOnly, [])
      // No MCU, so no I2C pin defines
      expect(emptySketch).not.toMatch(/#define\s+I2C_SDA/)
    })

    it('must contain XIAO BLE target comment in file header', () => {
      expect(sketch).toContain('XIAO BLE')
    })

    it('sketch must contain ENS160 @ 0x52 note (forced by ADDR=LOW for LTR-390 conflict avoidance)', () => {
      // The sketch notes that ENS160 ADDR pin must be pulled LOW to use 0x52
      expect(sketch).toMatch(/0x52/)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  B2: CSV Bill of Materials (BOM) Generator
  // ───────────────────────────────────────────────────────────────────────────
  describe('B2 — CSV BOM Generator', () => {
    let bom: string
    let bomLines: string[]

    beforeAll(() => {
      // Use all 11 component types to get full BOM
      const allNodes: Node[] = COMPONENT_LIBRARY.map((def, i) =>
        makeNode(`all_${i}`, def.typeId)
      )
      bom = generateCSVBOM(allNodes, [])
      bomLines = bom.split('\n')
    })

    it('should return a non-empty string', () => {
      expect(bom.length).toBeGreaterThan(50)
    })

    it('first line must be a CSV header row', () => {
      const header = bomLines[0]
      expect(header).toContain('Reference')
      expect(header).toContain('Value')
      expect(header).toContain('Quantity')
    })

    it('header must have exactly 8 columns', () => {
      const cols = bomLines[0].split(',')
      expect(cols).toHaveLength(8)
    })

    it('should contain XIAO BLE entry', () => {
      expect(bom).toMatch(/XIAO BLE/i)
    })

    it('should contain MAX30102 entry', () => {
      expect(bom).toMatch(/MAX30102/i)
    })

    it('should contain MPU-6050 entry', () => {
      expect(bom).toMatch(/MPU-6050/i)
    })

    it('should contain TMP117 entry', () => {
      expect(bom).toMatch(/TMP117/i)
    })

    it('should contain ENS160+AHT21 entry', () => {
      expect(bom).toMatch(/ENS160\+AHT21|ENS160/i)
    })

    it('should contain LTR-390 entry', () => {
      expect(bom).toMatch(/LTR-?390/i)
    })

    it('should contain LiPo battery entry', () => {
      expect(bom).toMatch(/LiPo|200mAh/i)
    })

    it('should contain resistor entries (4.7kΩ)', () => {
      expect(bom).toMatch(/4\.7k[Ωω]|4\.7K/i)
    })

    it('should contain capacitor entries (0.1µF)', () => {
      expect(bom).toMatch(/0\.1.F|100nF/i)
    })

    it('all data rows must have consistent comma-count matching the header', () => {
      const headerCols = bomLines[0].split(',').length
      // Parse rows — skip quoted fields properly (simplified: count commas outside quotes)
      const dataRows = bomLines.slice(1).filter(l => l.trim().length > 0)
      dataRows.forEach(row => {
        // Count commas outside of quoted sections
        let inQuote = false
        let commaCount = 0
        for (const ch of row) {
          if (ch === '"') inQuote = !inQuote
          if (ch === ',' && !inQuote) commaCount++
        }
        // Should have headerCols - 1 commas
        expect(commaCount).toBe(headerCols - 1)
      })
    })

    it('should have at least 8 data rows (one per hardware module)', () => {
      const dataRows = bomLines.slice(1).filter(l => l.trim().length > 0)
      // 11 component types → at least 8 BOM rows
      expect(dataRows.length).toBeGreaterThanOrEqual(8)
    })

    it('quantities must be positive integers', () => {
      const dataRows = bomLines.slice(1).filter(l => l.trim().length > 0)
      dataRows.forEach(row => {
        // The CSV has quoted fields (description contains commas). We need to
        // parse it properly: split on commas that are NOT inside double-quotes.
        const cols: string[] = []
        let current = ''
        let inQuote = false
        for (const ch of row) {
          if (ch === '"') {
            inQuote = !inQuote
          } else if (ch === ',' && !inQuote) {
            cols.push(current.trim())
            current = ''
          } else {
            current += ch
          }
        }
        cols.push(current.trim()) // last column
        // Column 4 (0-indexed) is Quantity
        const rawQty = parseInt(cols[4], 10)
        expect(Number.isInteger(rawQty)).toBe(true)
        expect(rawQty).toBeGreaterThan(0)
      })
    })

    it('empty canvas BOM should be header-only (no data rows)', () => {
      const emptyBOM = generateCSVBOM([], [])
      const lines = emptyBOM.split('\n').filter(l => l.trim().length > 0)
      expect(lines).toHaveLength(1) // Only header
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  B3: Netlist CSV Generator
  // ───────────────────────────────────────────────────────────────────────────
  describe('B3 — Netlist CSV Generator', () => {
    let netlist: string
    let netlistLines: string[]

    beforeAll(() => {
      netlist = generateNetlist(healthyNodes, healthyEdges)
      netlistLines = netlist.split('\n')
    })

    it('should return a non-empty string', () => {
      expect(netlist.length).toBeGreaterThan(20)
    })

    it('should have a comment header identifying the generator', () => {
      expect(netlist).toContain('IoT Schematic Canvas')
    })

    it('should have a NetName,Connections column header', () => {
      const headerLine = netlistLines.find(l => l.includes('NetName') && l.includes('Connections'))
      expect(headerLine).toBeDefined()
    })

    it('should produce net entries for edges (deduped by net-key)', () => {
      // generateNetlist groups same-named net keys, so data line count ≤ edge count.
      // With 18 edges, each getting a unique Net_xxx key, we expect 18 lines.
      // However, edges that share a net-key (e.g. multiple 3V3 connections) collapse.
      // Assert: at least 1 net line AND no more than the total edge count.
      const localDataLines = netlistLines.filter(
        l => !l.startsWith('#') && !l.startsWith('NetName') && l.trim().length > 0
      )
      expect(localDataLines.length).toBeGreaterThanOrEqual(1)
      expect(localDataLines.length).toBeLessThanOrEqual(healthyEdges.length)
    })

    it('each net line should contain at least one dot-separated pin reference', () => {
      const dataLines = netlistLines.filter(
        l => !l.startsWith('#') && !l.startsWith('NetName') && l.trim().length > 0
      )
      dataLines.forEach(line => {
        // Format: NetName,CompA.pinA,CompB.pinB
        expect(line).toMatch(/\w+\.\w+/)
      })
    })

    it('empty canvas generates only the header + comments (no net data)', () => {
      const emptyNetlist = generateNetlist([], [])
      const dataLines = emptyNetlist.split('\n').filter(
        l => !l.startsWith('#') && !l.startsWith('NetName') && l.trim().length > 0
      )
      expect(dataLines).toHaveLength(0)
    })
  })

  // ───────────────────────────────────────────────────────────────────────────
  //  B4: JSON Schema Exporter
  // ───────────────────────────────────────────────────────────────────────────
  describe('B4 — JSON Schema Exporter', () => {
    let jsonOutput: string
    let parsed: ReturnType<typeof JSON.parse>

    beforeAll(() => {
      jsonOutput = exportJSON(healthyNodes, healthyEdges, 'Test Schematic')
      parsed = JSON.parse(jsonOutput)
    })

    it('should produce valid JSON (no parse errors)', () => {
      expect(() => JSON.parse(jsonOutput)).not.toThrow()
    })

    it('should contain a version field', () => {
      expect(parsed).toHaveProperty('version')
      expect(typeof parsed.version).toBe('string')
    })

    it('should contain the project name', () => {
      expect(parsed.name).toBe('Test Schematic')
    })

    it('should contain a createdAt ISO timestamp', () => {
      expect(parsed.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    })

    it('should export correct number of nodes', () => {
      expect(parsed.nodes).toHaveLength(healthyNodes.length)
    })

    it('should export correct number of edges', () => {
      expect(parsed.edges).toHaveLength(healthyEdges.length)
    })

    it('each exported node must have id, type, and position fields', () => {
      parsed.nodes.forEach((node: Record<string, unknown>) => {
        expect(node).toHaveProperty('id')
        expect(node).toHaveProperty('type')
        expect(node).toHaveProperty('position')
      })
    })

    it('each exported edge must have id, source, and target fields', () => {
      parsed.edges.forEach((edge: Record<string, unknown>) => {
        expect(edge).toHaveProperty('id')
        expect(edge).toHaveProperty('source')
        expect(edge).toHaveProperty('target')
      })
    })

    it('node data must include typeId for component identification', () => {
      parsed.nodes.forEach((node: { data: Record<string, unknown> }) => {
        expect(node.data).toHaveProperty('typeId')
      })
    })

    it('serialization is idempotent — running twice produces identical output', () => {
      const first  = exportJSON(healthyNodes, healthyEdges, 'Test')
      const second = exportJSON(healthyNodes, healthyEdges, 'Test')
      // Strip timestamps before comparing
      const stripTimestamp = (s: string) => s.replace(/"createdAt":"[^"]+"/g, '"createdAt":""')
      expect(stripTimestamp(first)).toBe(stripTimestamp(second))
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
//  BLOCK C — Hardware Data Layer Integrity Tests
//  Verify that the component definitions match their actual datasheets
// ═══════════════════════════════════════════════════════════════════════════════
describe('Block C — Hardware Data Layer Integrity (Datasheet Compliance)', () => {

  it('COMPONENT_LIBRARY should contain exactly 11 entries', () => {
    expect(COMPONENT_LIBRARY).toHaveLength(11)
  })

  it('XIAO BLE: must have D4 as SDA pin', () => {
    const sda = XIAO_BLE.pins.find(p => p.id === 'd4_sda')
    expect(sda).toBeDefined()
    expect(sda!.signal).toBe('SDA')
  })

  it('XIAO BLE: must have D5 as SCL pin', () => {
    const scl = XIAO_BLE.pins.find(p => p.id === 'd5_scl')
    expect(scl).toBeDefined()
    expect(scl!.signal).toBe('SCL')
  })

  it('XIAO BLE: VUSB pin must be POWER_5V signal (dangerous rail)', () => {
    const vusb = XIAO_BLE.pins.find(p => p.id === 'vusb')
    expect(vusb).toBeDefined()
    expect(vusb!.signal).toBe('POWER_5V')
  })

  it('XIAO BLE: voltage rating must be 3.3V', () => {
    expect(XIAO_BLE.voltageRating).toBe(3.3)
  })

  it('MAX30102: I2C address must be 0x57 (fixed per datasheet)', () => {
    expect(MAX30102.i2cAddresses).toHaveLength(1)
    expect(MAX30102.i2cAddresses[0].hex).toBe('0x57')
  })

  it('MPU-6050: must have two I2C addresses (0x68 and 0x69)', () => {
    const hexes = MPU6050.i2cAddresses.map(a => a.hex)
    expect(hexes).toContain('0x68')
    expect(hexes).toContain('0x69')
  })

  it('MPU-6050: must have AD0 pin (address select)', () => {
    const ad0 = MPU6050.pins.find(p => p.id === 'ad0')
    expect(ad0).toBeDefined()
    expect(ad0!.signal).toBe('ADDR')
  })

  it('TMP117: must have 4 I2C addresses (ADD0 configurable)', () => {
    expect(TMP117.i2cAddresses).toHaveLength(4)
    const hexes = TMP117.i2cAddresses.map(a => a.hex)
    expect(hexes).toContain('0x48')
    expect(hexes).toContain('0x49')
    expect(hexes).toContain('0x4A')
    expect(hexes).toContain('0x4B')
  })

  it('ENS160+AHT21: must include AHT21 address 0x38 (fixed)', () => {
    const hexes = ENS160_AHT21.i2cAddresses.map(a => a.hex)
    expect(hexes).toContain('0x38')
  })

  it('ENS160+AHT21: must include both 0x52 and 0x53 ENS160 addresses', () => {
    const hexes = ENS160_AHT21.i2cAddresses.map(a => a.hex)
    expect(hexes).toContain('0x52')
    expect(hexes).toContain('0x53')
  })

  it('LTR-390: must have exactly ONE address 0x53 (hardwired, no config)', () => {
    expect(LTR390.i2cAddresses).toHaveLength(1)
    expect(LTR390.i2cAddresses[0].hex).toBe('0x53')
  })

  it('LTR-390: address condition note must warn about conflict', () => {
    const note = LTR390.i2cAddresses[0].condition ?? ''
    expect(note).toMatch(/conflict|CONFLICT|⚠️/i)
  })

  it('LiPo battery: must have BAT+ and BAT- pins', () => {
    const batPos = LIPO_BATTERY.pins.find(p => p.signal === 'BAT_POS')
    const batNeg = LIPO_BATTERY.pins.find(p => p.signal === 'BAT_NEG')
    expect(batPos).toBeDefined()
    expect(batNeg).toBeDefined()
  })

  it('4.7kΩ resistor: must be category Passive', () => {
    expect(RESISTOR_4K7.category).toBe('Passive')
  })

  it('All sensor components must have GND pin', () => {
    const sensors = COMPONENT_LIBRARY.filter(c => c.category === 'Sensor')
    sensors.forEach(sensor => {
      const gnd = sensor.pins.find(p => p.signal === 'GND')
      expect(gnd).toBeDefined()
    })
  })

  it('All I2C sensor components must have SDA and SCL pins', () => {
    const i2cSensors = COMPONENT_LIBRARY.filter(
      c => c.category === 'Sensor' && c.i2cAddresses.length > 0
    )
    i2cSensors.forEach(sensor => {
      const sda = sensor.pins.find(p => p.signal === 'SDA')
      const scl = sensor.pins.find(p => p.signal === 'SCL')
      expect(sda, `${sensor.shortLabel} missing SDA pin`).toBeDefined()
      expect(scl, `${sensor.shortLabel} missing SCL pin`).toBeDefined()
    })
  })

  it('No two different passive components should share the same typeId', () => {
    const typeIds = COMPONENT_LIBRARY.map(c => c.typeId)
    const uniqueTypeIds = new Set(typeIds)
    expect(uniqueTypeIds.size).toBe(COMPONENT_LIBRARY.length)
  })
})

  // ───────────────────────────────────────────────────────────────────────────
  //  Block D — Chaos Testing (Negative Testing)
  // ───────────────────────────────────────────────────────────────────────────
  describe('Block D — Chaos Testing & Destructive Configurations', () => {
    
    it('D1 — Multi-Device Address Stacking (3 devices at 0x53)', () => {
      const ens1 = makeNode('ens1', 'ens160_aht21')
      const ltr2 = makeNode('ltr2', 'ltr390')
      // Create a mock generic device that also uses 0x53 for test purposes
      const generic3: Node = {
        ...makeNode('gen3', 'tmp117'), // Use tmp117 template but override its addresses
        data: {
          ...makeNode('gen3', 'tmp117').data,
          componentDef: {
            ...(makeNode('gen3', 'tmp117').data as unknown as ComponentNodeData).componentDef,
            i2cAddresses: [{ hex: '0x53' }]
          }
        }
      }

      // Wire them together
      const edges: Edge[] = [
        makeEdge('e1', 'ens1', 'sda', 'ltr2', 'sda'),
        makeEdge('e2', 'ltr2', 'sda', 'gen3', 'sda'),
      ]

      const results = runDRC([ens1, ltr2, generic3], edges)
      
      // Must not have zero errors
      expect(results.length).toBeGreaterThan(0)
      
      // Find the specific address conflict error for 0x53
      const conflictError = results.find(r => r.message.includes('0x53 claimed by'))
      expect(conflictError).toBeDefined()
      
      // Assert it has escalated to CRITICAL_ERROR
      expect(conflictError!.severity).toBe('CRITICAL_ERROR')
      // Assert suggestion contains CATASTROPHIC wording
      expect(conflictError!.suggestion).toMatch(/CATASTROPHIC BUS COLLISION/i)
    })

    it('D2 — Direct VUSB to GND Short', () => {
      const xiao = makeNode('xiao1', 'xiao_ble_nrf52840')
      const edges: Edge[] = [
        makeEdge('short1', 'xiao1', 'vusb', 'xiao1', 'gnd1'),
      ]
      const results = runDRC([xiao], edges)
      
      expect(results.length).toBeGreaterThan(0)
      
      const shortError = results.find(r => r.message.includes('Power-to-GND Short'))
      expect(shortError).toBeDefined()
      expect(shortError!.severity).toBe('CRITICAL_ERROR')
    })

    it('D3 — Severe Reverse Bias on Battery', () => {
      const xiao = makeNode('xiao2', 'xiao_ble_nrf52840')
      const bat = makeNode('bat1', 'lipo_battery')
      
      // Wire backwards: BAT+ to GND, BAT- to 3V3
      const edges: Edge[] = [
        makeEdge('rev1', 'bat1', 'bat_pos', 'xiao2', 'gnd1'),
        makeEdge('rev2', 'bat1', 'bat_neg', 'xiao2', 'vcc_3v3'),
      ]
      const results = runDRC([xiao, bat], edges)
      expect(results.length).toBeGreaterThan(0)
      
      const revError = results.find(r => r.message.includes('Severe Reverse Bias'))
      expect(revError).toBeDefined()
      expect(revError!.severity).toBe('CRITICAL_ERROR')
    })

    it('D4 — Cross-Signal Sabotage (SDA to INT)', () => {
      const xiao = makeNode('xiao3', 'xiao_ble_nrf52840')
      const max = makeNode('max1', 'max30102')
      
      // Connect SDA to INT
      const edges: Edge[] = [
        makeEdge('cross1', 'xiao3', 'd4_sda', 'max1', 'int'),
      ]
      
      const results = runDRC([xiao, max], edges)
      expect(results.length).toBeGreaterThan(0)
      
      // The engine should flag this as a signal mismatch
      const mismatch = results.find(r => r.message.includes('Signal mismatch'))
      expect(mismatch).toBeDefined()
      expect(mismatch!.severity).toBe('error')
    })

    it('D5 — Passive Overload (Too many pull-ups)', () => {
      // Create 15 pull-up resistors manually
      const resistors: Node[] = Array.from({ length: 15 }).map((_, i) => ({
        id: `res${i}`,
        type: 'passive',
        position: { x: 0, y: 0 },
        data: {
          typeId: 'resistor_4k7',
          label: '4.7k',
          instanceId: `res${i}`,
          value: '4.7k',
          drcErrors: [],
          drcWarnings: []
        }
      }))
      
      const results = runDRC(resistors, [])
      expect(results.length).toBeGreaterThan(0)
      
      const overload = results.find(r => r.message.includes('Passive Overload'))
      expect(overload).toBeDefined()
      expect(overload!.severity).toBe('CRITICAL_ERROR')
    })

    it('D6 — Exporter fails safe on CRITICAL_ERROR', () => {
      // Use the battery short config from D3
      const xiao = makeNode('xiao2', 'xiao_ble_nrf52840')
      const bat = makeNode('bat1', 'lipo_battery')
      const edges: Edge[] = [
        makeEdge('rev1', 'bat1', 'bat_pos', 'xiao2', 'gnd1'),
        makeEdge('rev2', 'bat1', 'bat_neg', 'xiao2', 'vcc_3v3'),
      ]
      
      // Exporter should throw an exception instead of generating the dangerous sketch
      expect(() => {
        generateArduinoSketch([xiao, bat], edges)
      }).toThrow(/Export Blocked:.*Reverse Bias/)
    })
  })
