import { useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import {
  ZoomIn, ZoomOut, Maximize2, Trash2,
  Layers, Cpu, Code2, Network
} from 'lucide-react'

interface ToolbarProps {
  nodes: Node[]
  edges: Edge[]
  onClearCanvas: () => void
  onFitView: () => void
  nodeCount: number
  edgeCount: number
  errorCount: number
  warningCount: number
  isSimMode?: boolean
  onToggleSimMode?: () => void
}

export function Toolbar({
  nodes, edges,
  onClearCanvas, onFitView,
  nodeCount, edgeCount, errorCount, warningCount,
  isSimMode, onToggleSimMode
}: ToolbarProps) {

  return (
    <header
      className="flex items-center gap-3 px-4 py-2 flex-shrink-0"
      style={{
        height: 52,
        background: 'rgba(9,14,28,0.98)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
      }}
    >
      {/* Logo / Title */}
      <div className="flex items-center gap-2.5 mr-2">
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            boxShadow: '0 0 16px rgba(99,102,241,0.4)',
          }}
        >
          <Cpu size={16} className="text-white" />
        </div>
        <div>
          <div className="text-xs font-bold text-white/90 leading-none">IoT Schematic Canvas</div>
          <div className="text-[9px] text-white/40 leading-none mt-0.5">I2C Validator • nRF52840</div>
        </div>
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Stats */}
      <div className="flex items-center gap-3">
        <StatBadge icon={<Layers size={10} />} label={`${nodeCount} nodes`} />
        <StatBadge icon={<Network size={10} />} label={`${edgeCount} edges`} />
        {errorCount > 0 && (
          <StatBadge
            icon={<span className="text-[8px]">⚠</span>}
            label={`${errorCount} err`}
            color="rgba(239,68,68,0.8)"
          />
        )}
        {warningCount > 0 && (
          <StatBadge
            icon={<span className="text-[8px]">!</span>}
            label={`${warningCount} warn`}
            color="rgba(245,158,11,0.8)"
          />
        )}
      </div>

      <div className="flex-1" />

      {/* View controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onFitView}
          className="btn-icon"
          title="Fit view (F)"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      <div className="h-6 w-px bg-white/10" />

      {/* Simulation Toggle */}
      {onToggleSimMode && (
        <button
          onClick={onToggleSimMode}
          className={`btn-secondary ${isSimMode ? 'bg-blue-500/20 text-blue-400 border-blue-500/50' : 'text-white/70'}`}
          title="Toggle Simulation Mode"
        >
          <Code2 size={12} />
          <span className="hidden sm:inline">{isSimMode ? 'Exit Sim Mode' : 'Simulate'}</span>
        </button>
      )}

      {/* Clear canvas */}
      <button
        onClick={onClearCanvas}
        className="btn-secondary text-red-400/80 hover:text-red-400"
        title="Clear canvas"
      >
        <Trash2 size={12} />
        <span className="hidden sm:inline">Clear</span>
      </button>
    </header>
  )
}

function StatBadge({
  icon, label, color = 'rgba(255,255,255,0.4)',
}: {
  icon: React.ReactNode
  label: string
  color?: string
}) {
  return (
    <div className="flex items-center gap-1" style={{ color }}>
      {icon}
      <span className="text-[9px] font-mono">{label}</span>
    </div>
  )
}


