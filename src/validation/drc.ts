// ─────────────────────────────────────────────────────────────────────────────
//  Design Rule Check (DRC) Engine
//  Validates wiring correctness, I2C address conflicts, voltage mismatches etc.
// ─────────────────────────────────────────────────────────────────────────────

import type { Node, Edge } from '@xyflow/react'
import type { DRCResult, ComponentNodeData, PassiveNodeData, SignalType } from '../types'
import { COMPATIBLE_SIGNALS, SIGNAL_LABELS } from '../data/components'

// ─── Parse handle IDs ─────────────────────────────────────────────────────────
// Handle format: "{nodeId}__{pinId}"
function parseHandle(handleId: string | null | undefined): { nodeId: string; pinId: string } | null {
  if (!handleId) return null
  const parts = handleId.split('__')
  if (parts.length < 2) return null
  return { nodeId: parts[0], pinId: parts[1] }
}

// ─── Get signal type of a handle ─────────────────────────────────────────────
function getHandleSignal(
  nodeId: string,
  pinId: string,
  nodes: Node[]
): SignalType | null {
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null
  const data = node.data as ComponentNodeData
  if (!data?.componentDef) return null
  const pin = data.componentDef.pins.find(p => p.id === pinId)
  return pin ? pin.signal : null
}

// ─── Get all nodes with I2C addresses connected to the bus ───────────────────
function getI2CNodesOnBus(nodes: Node[], edges: Edge[]): Map<string, string[]> {
  // Find all SDA-SDA edges (indicates I2C bus connection)
  const i2cEdges = edges.filter(e => {
    const srcSignal = getHandleSignal(
      parseHandle(e.sourceHandle)?.nodeId ?? e.source,
      parseHandle(e.sourceHandle)?.pinId ?? '',
      nodes
    )
    return srcSignal === 'SDA'
  })

  // Collect node IDs that are on the I2C bus
  const busNodeIds = new Set<string>()
  i2cEdges.forEach(e => {
    busNodeIds.add(e.source)
    busNodeIds.add(e.target)
  })

  // Build map: hex address → node labels
  const addressMap = new Map<string, string[]>()
  nodes.forEach(node => {
    if (!busNodeIds.has(node.id)) return
    const data = node.data as ComponentNodeData
    if (!data?.componentDef?.i2cAddresses) return
    data.componentDef.i2cAddresses.forEach(addr => {
      const existing = addressMap.get(addr.hex) ?? []
      existing.push(node.id)
      addressMap.set(addr.hex, existing)
    })
  })

  return addressMap
}

// ─── Check if an SCL connection also exists for a node ───────────────────────
function hasI2CComplete(nodeId: string, edges: Edge[], nodes: Node[]): boolean {
  let hasSDA = false
  let hasSCL = false
  edges.forEach(e => {
    if (e.source !== nodeId && e.target !== nodeId) return
    const handleId = e.source === nodeId ? e.sourceHandle : e.targetHandle
    const parsed = parseHandle(handleId)
    const nodeForHandle = e.source === nodeId ? e.source : e.target
    if (!parsed) return
    const sig = getHandleSignal(nodeForHandle, parsed.pinId, nodes)
    if (sig === 'SDA') hasSDA = true
    if (sig === 'SCL') hasSCL = true
  })
  return hasSDA && hasSCL
}

// ─── Check for pull-up resistors on I2C bus ──────────────────────────────────
function hasPullupResistors(nodes: Node[]): { sda: boolean; scl: boolean } {
  // A resistor node counts if its type is resistor_4k7 or resistor_10k
  const hasResistor = nodes.some(
    n => (n.data as ComponentNodeData)?.typeId === 'resistor_4k7' ||
         (n.data as ComponentNodeData)?.typeId === 'resistor_10k'
  )
  // Simplified check — if ANY resistor is on the canvas, assume it's used for pull-up
  return { sda: hasResistor, scl: hasResistor }
}

// ─── Main DRC runner ──────────────────────────────────────────────────────────
export function runDRC(nodes: Node[], edges: Edge[]): DRCResult[] {
  const results: DRCResult[] = []
  let ruleIdx = 0

  // ── Rule 1: Incompatible Signal Connection ─────────────────────────────────
  edges.forEach(edge => {
    const srcParsed = parseHandle(edge.sourceHandle)
    const tgtParsed = parseHandle(edge.targetHandle)
    if (!srcParsed || !tgtParsed) return

    const srcSignal = getHandleSignal(srcParsed.nodeId, srcParsed.pinId, nodes)
    const tgtSignal = getHandleSignal(tgtParsed.nodeId, tgtParsed.pinId, nodes)

    if (!srcSignal || !tgtSignal) return

    const allowed = COMPATIBLE_SIGNALS[srcSignal] ?? []
    if (!allowed.includes(tgtSignal)) {
      results.push({
        id: `drc_signal_${ruleIdx++}`,
        severity: 'error',
        message: `Signal mismatch: ${SIGNAL_LABELS[srcSignal]} → ${SIGNAL_LABELS[tgtSignal]}`,
        detail: `Cannot connect a ${SIGNAL_LABELS[srcSignal]} pin to a ${SIGNAL_LABELS[tgtSignal]} pin`,
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Disconnect and rewire to compatible signal types',
      })
    }
  })

  // ── Rule 2: Voltage Mismatches & Direct Power Shorts ───────────────────────
  edges.forEach(edge => {
    const srcParsed = parseHandle(edge.sourceHandle)
    const tgtParsed = parseHandle(edge.targetHandle)
    if (!srcParsed || !tgtParsed) return

    const srcSignal = getHandleSignal(srcParsed.nodeId, srcParsed.pinId, nodes)
    const tgtSignal = getHandleSignal(tgtParsed.nodeId, tgtParsed.pinId, nodes)
    const tgtNode = nodes.find(n => n.id === edge.target)
    const tgtData = tgtNode?.data as ComponentNodeData | undefined

    // Direct Power to GND Short (VUSB/5V or 3.3V to GND)
    if (
      (srcSignal?.startsWith('POWER') && tgtSignal === 'GND') ||
      (tgtSignal?.startsWith('POWER') && srcSignal === 'GND')
    ) {
      results.push({
        id: `drc_power_short_${ruleIdx++}`,
        severity: 'CRITICAL_ERROR',
        message: '🔥 Direct Power-to-GND Short Circuit!',
        detail: `Connecting ${SIGNAL_LABELS[srcSignal!]} directly to ${SIGNAL_LABELS[tgtSignal!]} creates a dead short. This will cause catastrophic failure.`,
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Remove the connection immediately.',
      })
    }

    // Battery Reverse Bias (BAT+ to GND or BAT- to POWER/3V3)
    if (
      (srcSignal === 'BAT_POS' && (tgtSignal === 'GND' || tgtSignal === 'BAT_NEG')) ||
      (tgtSignal === 'BAT_POS' && (srcSignal === 'GND' || srcSignal === 'BAT_NEG')) ||
      (srcSignal === 'BAT_NEG' && tgtSignal?.startsWith('POWER')) ||
      (tgtSignal === 'BAT_NEG' && srcSignal?.startsWith('POWER'))
    ) {
      results.push({
        id: `drc_reverse_bias_${ruleIdx++}`,
        severity: 'CRITICAL_ERROR',
        message: '🔥 Severe Reverse Bias / Battery Short!',
        detail: `Connecting ${SIGNAL_LABELS[srcSignal!]} to ${SIGNAL_LABELS[tgtSignal!]} creates a reverse bias or dead short on the lithium battery. This will cause fire or explosion.`,
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Remove the connection immediately.',
      })
    }

    if (
      srcSignal === 'POWER_5V' &&
      tgtData?.componentDef?.voltageRating === 3.3
    ) {
      results.push({
        id: `drc_voltage_${ruleIdx++}`,
        severity: 'error',
        message: `5V connected to 3.3V-only component: ${tgtData.componentDef.shortLabel}`,
        detail: `${tgtData.componentDef.label} operates at 3.3V max. Connecting 5V WILL damage the IC!`,
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Use a 3.3V supply or add a 3.3V LDO regulator',
      })
    }
  })

  // ── Rule 3: I2C Address Conflicts ──────────────────────────────────────────
  const addressMap = getI2CNodesOnBus(nodes, edges)
  addressMap.forEach((nodeIds, hex) => {
    if (nodeIds.length > 1) {
      const labels = nodeIds.map(id => {
        const data = nodes.find(n => n.id === id)?.data as ComponentNodeData
        return data?.componentDef?.shortLabel ?? id
      })

      let suggestion = `Two or more devices share I2C address ${hex}. Only one device can exist at each address.`
      let severity: import('../types').DRCSeverity = 'error'

      // Escalation for 3 or more devices at the same address
      if (nodeIds.length >= 3) {
        severity = 'CRITICAL_ERROR'
        suggestion = `CATASTROPHIC BUS COLLISION: ${nodeIds.length} devices share I2C address ${hex}. The bus will be completely unusable.`
      } else {
        // Specific suggestion for ENS160 vs LTR-390 @ 0x53
        if (hex === '0x53') {
          suggestion =
            'ENS160 and LTR-390 both use 0x53 by default. Set ENS160 ADDR pin LOW (pull to GND) to use address 0x52 instead.'
        }
        // MPU-6050 AD0 suggestion
        if (hex === '0x68' || hex === '0x69') {
          suggestion = `Set MPU-6050 AD0 pin HIGH/LOW to change address. 0x68 = AD0 LOW, 0x69 = AD0 HIGH.`
        }
      }

      results.push({
        id: `drc_addr_${hex}_${ruleIdx++}`,
        severity,
        message: `I2C address conflict: ${hex} claimed by [${labels.join(', ')}]`,
        detail: `Multiple devices on the same I2C bus cannot share address ${hex}`,
        affectedNodeIds: nodeIds,
        affectedEdgeIds: [],
        suggestion,
      })
    }
  })

  // ── Rule 4: I2C devices connected but no pull-up resistors ────────────────
  const hasI2CDevices = nodes.some(n => {
    const data = n.data as ComponentNodeData
    return data?.componentDef?.i2cAddresses?.length > 0
  })
  const hasI2CEdges = edges.some(e => {
    const srcParsed = parseHandle(e.sourceHandle)
    if (!srcParsed) return false
    return getHandleSignal(srcParsed.nodeId, srcParsed.pinId, nodes) === 'SDA'
  })

  if (hasI2CDevices && hasI2CEdges) {
    const pullups = hasPullupResistors(nodes)
    if (!pullups.sda) {
      results.push({
        id: `drc_pullup_${ruleIdx++}`,
        severity: 'warning',
        message: 'No I2C pull-up resistors detected on SDA/SCL',
        detail: 'I2C SDA and SCL lines require pull-up resistors to 3.3V (recommended: 4.7kΩ at 400kHz)',
        affectedNodeIds: [],
        affectedEdgeIds: [],
        suggestion: 'Add 4.7kΩ resistors from both SDA and SCL to 3.3V rail',
      })
    }
  }

  // ── Check D5: Passive Overload (Too many pull-ups on I2C bus)
  const passiveNodes = nodes.filter(n => (n.data as unknown as ComponentNodeData)?.componentDef?.category === 'Passive')
  if (passiveNodes.length > 5) { 
    results.push({
      id: `drc_passive_overload_${ruleIdx++}`,
      severity: 'CRITICAL_ERROR',
      message: 'Passive Overload: Too many pull-up resistors on bus',
      detail: 'Connecting too many pull-up resistors in parallel drops the equivalent resistance too low, which can damage the open-drain pins of I2C devices.',
      affectedNodeIds: passiveNodes.map(n => n.id),
      affectedEdgeIds: [],
      suggestion: 'Remove extra pull-up resistors. Only one pair is needed per bus.',
    })
  }

  // ── Rule 5: I2C device with SDA connected but no SCL (or vice versa) ───────
  nodes.forEach(node => {
    const data = node.data as ComponentNodeData
    if (!data?.componentDef?.i2cAddresses?.length) return
    if (data.componentDef.i2cAddresses.length === 0) return

    // Only flag if the node has ANY edge connected (else it's just on the palette)
    const connectedEdges = edges.filter(e => e.source === node.id || e.target === node.id)
    if (connectedEdges.length === 0) return

    const complete = hasI2CComplete(node.id, edges, nodes)
    if (!complete) {
      results.push({
        id: `drc_i2c_partial_${node.id}_${ruleIdx++}`,
        severity: 'warning',
        message: `Incomplete I2C connection on ${data.componentDef?.shortLabel ?? node.id}`,
        detail: 'I2C requires both SDA and SCL to be connected',
        affectedNodeIds: [node.id],
        affectedEdgeIds: [],
        suggestion: 'Connect both SDA and SCL pins to MCU D4/SDA and D5/SCL',
      })
    }
  })

  // ── Rule 6: I2C bus has no MCU ─────────────────────────────────────────────
  const mcuNodes = nodes.filter(n => {
    const data = n.data as ComponentNodeData
    return data?.componentDef?.category === 'MCU'
  })
  const sdaEdgeNodeIds = new Set<string>()
  edges.forEach(e => {
    const srcParsed = parseHandle(e.sourceHandle)
    if (!srcParsed) return
    if (getHandleSignal(srcParsed.nodeId, srcParsed.pinId, nodes) === 'SDA') {
      sdaEdgeNodeIds.add(e.source)
      sdaEdgeNodeIds.add(e.target)
    }
  })

  const sensorNodesOnBus = nodes.filter(n => {
    const data = n.data as ComponentNodeData
    return (
      data?.componentDef?.i2cAddresses?.length > 0 &&
      sdaEdgeNodeIds.has(n.id)
    )
  })

  if (sensorNodesOnBus.length > 0) {
    const mcuOnBus = mcuNodes.some(m => sdaEdgeNodeIds.has(m.id))
    if (!mcuOnBus) {
      results.push({
        id: `drc_no_mcu_${ruleIdx++}`,
        severity: 'warning',
        message: 'I2C sensors wired but no MCU detected on the bus',
        detail: 'Sensors are connected to each other via I2C but no MCU (master) is on the bus',
        affectedNodeIds: sensorNodesOnBus.map(n => n.id),
        affectedEdgeIds: [],
        suggestion: 'Connect XIAO BLE D4(SDA) and D5(SCL) to the I2C bus',
      })
    }
  }

  // ── Rule 7: Battery polarity & Reverse Bias ───────────────────────────────
  edges.forEach(edge => {
    const srcParsed = parseHandle(edge.sourceHandle)
    const tgtParsed = parseHandle(edge.targetHandle)
    if (!srcParsed || !tgtParsed) return

    const srcSignal = getHandleSignal(srcParsed.nodeId, srcParsed.pinId, nodes)
    const tgtSignal = getHandleSignal(tgtParsed.nodeId, tgtParsed.pinId, nodes)

    // Direct BAT+ to BAT- short
    if (
      (srcSignal === 'BAT_POS' && tgtSignal === 'BAT_NEG') ||
      (srcSignal === 'BAT_NEG' && tgtSignal === 'BAT_POS')
    ) {
      results.push({
        id: `drc_bat_pol_${ruleIdx++}`,
        severity: 'CRITICAL_ERROR',
        message: '⚡ Battery short circuit! BAT+ connected to BAT-',
        detail: 'This will destroy the battery and potentially cause a fire',
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Connect BAT+ to XIAO BAT+ pad and BAT- to XIAO BAT- pad separately',
      })
    }
    
    // Severe Reverse Bias: BAT+ to GND, or BAT- to POWER
    if (
      (srcSignal === 'BAT_POS' && tgtSignal === 'GND') ||
      (tgtSignal === 'BAT_POS' && srcSignal === 'GND') ||
      (srcSignal === 'BAT_NEG' && tgtSignal?.startsWith('POWER')) ||
      (tgtSignal === 'BAT_NEG' && srcSignal?.startsWith('POWER'))
    ) {
      results.push({
        id: `drc_bat_rev_bias_${ruleIdx++}`,
        severity: 'CRITICAL_ERROR',
        message: '🔥 Severe Reverse Bias on Battery!',
        detail: 'Battery is connected backwards relative to the system rails (BAT+ to GND or BAT- to VDD).',
        affectedNodeIds: [edge.source, edge.target],
        affectedEdgeIds: [edge.id],
        suggestion: 'Correct the polarity. Connect BAT+ to system power/charging circuit and BAT- to system GND.',
      })
    }
  })

  // ── Rule 8: ENS160 ADDR warning when LTR-390 present ──────────────────────
  const hasENS160 = nodes.some(n => (n.data as ComponentNodeData)?.typeId === 'ens160_aht21')
  const hasLTR390 = nodes.some(n => (n.data as ComponentNodeData)?.typeId === 'ltr390')
  if (hasENS160 && hasLTR390) {
    // Check if ENS160 ADDR is floating/unconnected (defaults to 0x53)
    const ens160Nodes = nodes.filter(n => (n.data as ComponentNodeData)?.typeId === 'ens160_aht21')
    ens160Nodes.forEach(ens => {
      const addrPin = ens.data as ComponentNodeData
      const addrConnected = edges.some(e => {
        if (e.source !== ens.id && e.target !== ens.id) return false
        const h = e.source === ens.id ? e.sourceHandle : e.targetHandle
        const p = parseHandle(h)
        return p?.pinId === 'addr'
      })
      if (!addrConnected) {
        results.push({
          id: `drc_ens160_addr_${ruleIdx++}`,
          severity: 'warning',
          message: '⚠️ ENS160 ADDR pin unconnected — may conflict with LTR-390 @ 0x53',
          detail: `Both ENS160 (ADDR=float/HIGH → 0x53) and LTR-390 (fixed 0x53) share the same I2C address. The ${addrPin.componentDef?.shortLabel} ADDR pin must be pulled LOW to use address 0x52.`,
          affectedNodeIds: [ens.id, ...nodes.filter(n => (n.data as ComponentNodeData)?.typeId === 'ltr390').map(n => n.id)],
          affectedEdgeIds: [],
          suggestion: 'Pull ENS160 ADDR pin to GND (use 10kΩ resistor) to select I2C address 0x52',
        })
      }
    })
  }

  // ── Rule 9: LTR-390 address conflict info ─────────────────────────────────
  if (hasENS160 && hasLTR390) {
    results.push({
      id: `drc_ltr390_info_${ruleIdx++}`,
      severity: 'info',
      message: 'LTR-390 address 0x53 is FIXED — set ENS160 ADDR=LOW for 0x52',
      detail: 'LTR-390 I2C address cannot be changed. ENS160 must be configured to 0x52.',
      affectedNodeIds: [],
      affectedEdgeIds: [],
      suggestion: 'Wire ENS160 ADDR pin to GND via 10kΩ resistor → ENS160 will use 0x52',
    })
  }

  // ── Rule 10: Passive Overload (I2C Pull-up) ────────────────────────────────
  const pullupNodes = nodes.filter(n => {
    const data = n.data as ComponentNodeData | PassiveNodeData
    return data?.typeId === 'resistor_4k7' || data?.typeId === 'resistor_10k'
  })
  
  if (pullupNodes.length > 5) {
    results.push({
      id: `drc_passive_overload_${ruleIdx++}`,
      severity: 'CRITICAL_ERROR',
      message: '⚡ Passive Overload: Too many pull-up resistors',
      detail: `Detected ${pullupNodes.length} pull-up resistors. Too many parallel resistors will drop the equivalent resistance below safe limits (< 300Ω), overloading the I2C bus driver.`,
      affectedNodeIds: pullupNodes.map(n => n.id),
      affectedEdgeIds: [],
      suggestion: 'Remove excess pull-up resistors. Only one or two sets (SDA/SCL) are needed for the entire bus.',
    })
  }

  return results
}

// ─── Build I2C address bus report ─────────────────────────────────────────────
export interface I2CBusEntry {
  hex: string
  nodeId: string
  label: string
  shortLabel: string
  condition?: string
  isConflict: boolean
}

export function buildI2CBusReport(nodes: Node[], edges: Edge[]): I2CBusEntry[] {
  const addressMap = getI2CNodesOnBus(nodes, edges)
  const entries: I2CBusEntry[] = []

  // Also include all I2C components even if not wired yet
  nodes.forEach(node => {
    const data = node.data as ComponentNodeData
    if (!data?.componentDef?.i2cAddresses?.length) return
    data.componentDef.i2cAddresses.forEach(addr => {
      const conflictNodeIds = addressMap.get(addr.hex) ?? []
      const isConflict = conflictNodeIds.length > 1

      // Avoid duplicate entries
      const alreadyAdded = entries.some(e => e.nodeId === node.id && e.hex === addr.hex)
      if (!alreadyAdded) {
        entries.push({
          hex: addr.hex,
          nodeId: node.id,
          label: data.componentDef.label,
          shortLabel: data.componentDef.shortLabel,
          condition: addr.condition,
          isConflict,
        })
      }
    })
  })

  return entries.sort((a, b) => a.hex.localeCompare(b.hex))
}
