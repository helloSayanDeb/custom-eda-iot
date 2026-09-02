import type { Node, Edge } from '@xyflow/react'
import type { ComponentNodeData } from '../types'

export function exportJSON(nodes: Node[], edges: Edge[], projectName = 'IoT Schematic'): string {
  const project = {
    version: '1.0.0',
    name: projectName,
    generator: 'IoT Schematic Canvas — I2C Validator',
    createdAt: new Date().toISOString(),
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        typeId: (n.data as ComponentNodeData).typeId,
        label: (n.data as ComponentNodeData).label,
        instanceId: (n.data as ComponentNodeData).instanceId,
        selectedI2CAddress: (n.data as ComponentNodeData).selectedI2CAddress,
      },
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
      type: e.type,
      label: e.label,
    })),
  }
  return JSON.stringify(project, null, 2)
}

export function downloadJSON(nodes: Node[], edges: Edge[], projectName = 'iot_schematic'): void {
  const content = exportJSON(nodes, edges, projectName)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${projectName.replace(/\s+/g, '_').toLowerCase()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
