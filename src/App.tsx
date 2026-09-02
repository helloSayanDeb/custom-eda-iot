import { useCallback, useRef, useState, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  BackgroundVariant,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { ComponentNode } from './nodes/ComponentNode'
import { PassiveNode } from './nodes/PassiveNode'
import { SignalEdge } from './edges/SignalEdge'
import { Sidebar } from './components/Sidebar'
import { ValidationPanel } from './components/ValidationPanel'
import { Toolbar } from './components/Toolbar'
import { AddressMonitor } from './components/AddressMonitor'
import { ConfirmDialog } from './components/ConfirmDialog'

import { COMPONENT_LIBRARY, SIGNAL_COLORS, COMPATIBLE_SIGNALS } from './data/components'
import { runDRC, buildI2CBusReport } from './validation/drc'
import type { ComponentDefinition, ComponentNodeData, SignalType } from './types'

// ─── Node & Edge type registrations ──────────────────────────────────────────
const nodeTypes = {
  component: ComponentNode,
  passive: PassiveNode,
}

const edgeTypes = {
  signal: SignalEdge,
}

// ─── ID counter ───────────────────────────────────────────────────────────────
let nodeIdCounter = 1
const genNodeId = () => `node_${nodeIdCounter++}_${Date.now()}`

// ─── Parse handle to get signal type ─────────────────────────────────────────
function getHandleSignalFromNodes(handleId: string | null | undefined, nodeId: string, nodes: Node[]): SignalType | null {
  if (!handleId) return null
  const pinId = handleId.split('__')[1]?.replace('_bi', '').replace('_s', '').replace('_t', '') ?? ''
  const node = nodes.find(n => n.id === nodeId)
  if (!node) return null
  const data = node.data as unknown as ComponentNodeData
  const pin = data?.componentDef?.pins?.find(p => p.id === pinId)
  return pin?.signal ?? null
}

// ─── Inner App (needs ReactFlowProvider) ─────────────────────────────────────
function AppInner() {
  const reactFlowWrapper = useRef<HTMLDivElement>(null)
  const { screenToFlowPosition, fitView } = useReactFlow()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [rightTab, setRightTab] = useState<'drc' | 'i2c'>('drc')
  const [showClearConfirm, setShowClearConfirm] = useState(false)

  // ── DRC results ─────────────────────────────────────────────────────────────
  const [drcResults, setDrcResults] = useState(() => runDRC([], []))
  const [i2cEntries, setI2cEntries] = useState(() => buildI2CBusReport([], []))

  // Stable key for edges: sorted joined IDs so DRC re-runs on connect/disconnect
  const edgeKey = [...edges].sort((a, b) => a.id.localeCompare(b.id)).map(e => e.id).join(',')

  useEffect(() => {
    const results = runDRC(nodes, edges)
    setDrcResults(results)
    setI2cEntries(buildI2CBusReport(nodes, edges))

    // Annotate nodes with their DRC errors/warnings
    setNodes(prev => prev.map(node => {
      const nodeErrors = results
        .filter(r => r.severity === 'error' && r.affectedNodeIds.includes(node.id))
        .map(r => r.message)
      const nodeWarnings = results
        .filter(r => r.severity === 'warning' && r.affectedNodeIds.includes(node.id))
        .map(r => r.message)

      const data = node.data as unknown as ComponentNodeData
      if (
        JSON.stringify(data.drcErrors) === JSON.stringify(nodeErrors) &&
        JSON.stringify(data.drcWarnings) === JSON.stringify(nodeWarnings)
      ) {
        return node
      }
      return {
        ...node,
        data: { ...node.data, drcErrors: nodeErrors, drcWarnings: nodeWarnings },
      }
    }))
  }, [nodes.length, edgeKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Connection handler ──────────────────────────────────────────────────────
  const onConnect = useCallback((params: Connection) => {
    const srcSignal = getHandleSignalFromNodes(params.sourceHandle, params.source ?? '', nodes)
    const tgtSignal = getHandleSignalFromNodes(params.targetHandle, params.target ?? '', nodes)

    const signal: SignalType = srcSignal ?? tgtSignal ?? 'NC'
    const color = SIGNAL_COLORS[signal] ?? '#6b7280'

    // Check compatibility
    const allowed = COMPATIBLE_SIGNALS[signal] ?? []
    const targetSig = tgtSignal ?? 'NC'
    const compatible = allowed.includes(targetSig) || srcSignal === null || tgtSignal === null

    const edgeLabel = srcSignal ? `${srcSignal}` : undefined

    const newEdge: Edge = {
      ...params,
      id: `edge_${Date.now()}`,
      type: 'signal',
      animated: signal === 'SDA' || signal === 'SCL',
      label: edgeLabel,
      style: {
        stroke: compatible ? color : '#ef4444',
        strokeWidth: signal === 'POWER_3V3' || signal === 'GND' ? 2.5 : 2,
      },
      data: {
        signal,
        label: edgeLabel,
      } as Record<string, unknown>,
    }

    setEdges(eds => addEdge(newEdge, eds))
  }, [nodes, setEdges])

  // ── Drag-and-drop from sidebar ─────────────────────────────────────────────
  const onDragStart = useCallback((e: React.DragEvent, def: ComponentDefinition) => {
    e.dataTransfer.setData('componentTypeId', def.typeId)
    e.dataTransfer.effectAllowed = 'copy'
  }, [])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setIsDragOver(true)
  }, [])

  const onDragLeave = useCallback(() => {
    setIsDragOver(false)
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)

    const typeId = e.dataTransfer.getData('componentTypeId')
    if (!typeId) return

    const def = COMPONENT_LIBRARY.find(c => c.typeId === typeId)
    if (!def) return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })

    const nodeId = genNodeId()
    const instanceId = `${def.shortLabel.replace(/[^a-zA-Z0-9]/g, '')}_${nodeIdCounter}`

    const isPassive = def.category === 'Passive'

    const newNode: Node = {
      id: nodeId,
      type: isPassive ? 'passive' : 'component',
      position: {
        x: position.x - def.width / 2,
        y: position.y - def.height / 2,
      },
      data: isPassive
        ? {
            typeId: def.typeId,
            label: def.shortLabel,
            instanceId,
            value: def.shortLabel,
            drcErrors: [],
            drcWarnings: [],
          } as Record<string, unknown>
        : {
            typeId: def.typeId,
            label: def.shortLabel,
            instanceId,
            componentDef: def,
            drcErrors: [],
            drcWarnings: [],
          } as Record<string, unknown>,
    }

    setNodes(prev => [...prev, newNode])
  }, [screenToFlowPosition, setNodes])

  // ── Highlight nodes from DRC click ────────────────────────────────────────
  const onHighlightNodes = useCallback((nodeIds: string[]) => {
    setNodes(prev => prev.map(n => ({
      ...n,
      selected: nodeIds.includes(n.id),
    })))
  }, [setNodes])

  // ── Clear canvas ──────────────────────────────────────────────────────────
  const onClearCanvas = useCallback(() => {
    setShowClearConfirm(true)
  }, [])

  const onClearConfirmed = useCallback(() => {
    setNodes([])
    setEdges([])
    setShowClearConfirm(false)
  }, [setNodes, setEdges])

  const onClearCancelled = useCallback(() => {
    setShowClearConfirm(false)
  }, [])

  // ── MCU on bus check ──────────────────────────────────────────────────────
  const mcuConnected = nodes.some(n => {
    const data = n.data as unknown as ComponentNodeData
    return data?.componentDef?.category === 'MCU'
  })

  const errorCount   = drcResults.filter(r => r.severity === 'error').length
  const warningCount = drcResults.filter(r => r.severity === 'warning').length

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden">
      {/* Custom confirm dialog */}
      <ConfirmDialog
        open={showClearConfirm}
        title="Clear Canvas"
        message="This will remove all components and connections. This action cannot be undone."
        confirmLabel="Yes, Clear All"
        cancelLabel="Cancel"
        onConfirm={onClearConfirmed}
        onCancel={onClearCancelled}
        danger
      />

      {/* Toolbar */}
      <Toolbar
        nodes={nodes}
        edges={edges}
        onClearCanvas={onClearCanvas}
        onFitView={() => fitView({ padding: 0.2, duration: 400 })}
        nodeCount={nodes.length}
        edgeCount={edges.length}
        errorCount={errorCount}
        warningCount={warningCount}
      />

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — component palette */}
        <Sidebar onDragStart={onDragStart} />

        {/* Canvas */}
        <div
          ref={reactFlowWrapper}
          className={`flex-1 relative transition-all duration-200 ${isDragOver ? 'canvas-drag-over' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            minZoom={0.2}
            maxZoom={3}
            proOptions={{ hideAttribution: true }}
            deleteKeyCode={['Backspace', 'Delete']}
            connectionLineStyle={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '5 3' }}
            defaultEdgeOptions={{
              type: 'signal',
              animated: false,
            }}
          >
            <Background
              variant={BackgroundVariant.Dots}
              gap={24}
              size={1.5}
              color="#1e293b"
            />
            <Controls
              position="bottom-left"
              showInteractive={true}
            />
            <MiniMap
              position="bottom-right"
              nodeColor={n => {
                const data = n.data as unknown as ComponentNodeData
                return data?.componentDef?.color ?? '#6366f1'
              }}
              maskColor="rgba(2,6,23,0.8)"
              style={{ borderRadius: 10 }}
            />

            {/* Drop hint when canvas empty */}
            {nodes.length === 0 && !isDragOver && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
                style={{ zIndex: 1 }}
              >
                <div
                  className="rounded-2xl px-8 py-6 text-center"
                  style={{
                    background: 'rgba(15,23,42,0.7)',
                    border: '1px dashed rgba(99,102,241,0.3)',
                    backdropFilter: 'blur(8px)',
                  }}
                >
                  <div className="text-4xl mb-3 opacity-60">🖥️</div>
                  <div className="text-sm font-semibold text-white/60 mb-1">
                    Drag components from the palette
                  </div>
                  <div className="text-xs text-white/30">
                    Connect pins by dragging between handles
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-6 text-[9px] text-white/25">
                    <span>🔴 Power</span>
                    <span>⚫ GND</span>
                    <span>🔵 SDA</span>
                    <span>🟡 SCL</span>
                    <span>🟢 GPIO</span>
                  </div>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>

        {/* Right panel — Validation + I2C Monitor */}
        <div
          className="flex flex-col h-full"
          style={{
            width: 300,
            background: 'rgba(9,14,28,0.97)',
            borderLeft: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          {/* Tab bar */}
          <div
            className="flex border-b border-white/5 flex-shrink-0"
            style={{ background: 'rgba(0,0,0,0.2)' }}
          >
            <TabButton
              active={rightTab === 'drc'}
              onClick={() => setRightTab('drc')}
              label="DRC"
              badge={errorCount + warningCount}
              badgeColor={errorCount > 0 ? '#ef4444' : '#f59e0b'}
            />
            <TabButton
              active={rightTab === 'i2c'}
              onClick={() => setRightTab('i2c')}
              label="I2C Bus"
              badge={i2cEntries.length}
              badgeColor="#6366f1"
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {rightTab === 'drc' ? (
              <ValidationPanel
                results={drcResults}
                onHighlightNodes={onHighlightNodes}
              />
            ) : (
              <AddressMonitor
                entries={i2cEntries}
                mcuConnected={mcuConnected}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabButton({
  active, onClick, label, badge, badgeColor,
}: {
  active: boolean
  onClick: () => void
  label: string
  badge: number
  badgeColor: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] font-medium transition-all"
      style={{
        color: active ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.35)',
        borderBottom: active ? '2px solid #6366f1' : '2px solid transparent',
        background: active ? 'rgba(99,102,241,0.06)' : 'transparent',
      }}
    >
      {label}
      {badge > 0 && (
        <span
          className="text-[8px] font-bold px-1.5 py-0.5 rounded-full"
          style={{ background: `${badgeColor}25`, color: badgeColor }}
        >
          {badge}
        </span>
      )}
    </button>
  )
}

// ─── Wrap with provider ───────────────────────────────────────────────────────
export default function App() {
  return (
    <ReactFlowProvider>
      <AppInner />
    </ReactFlowProvider>
  )
}
