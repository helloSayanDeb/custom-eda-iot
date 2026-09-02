import { useState } from 'react'
import type { Node, Edge } from '@xyflow/react'
import {
  Download, FileJson, Code2, Table2, Network,
  ZoomIn, ZoomOut, Maximize2, Trash2,
  ChevronDown, Layers, Cpu,
} from 'lucide-react'
import { downloadJSON } from '../export/exportJSON'
import { downloadArduinoSketch } from '../export/exportArduino'
import { downloadBOM, downloadNetlist } from '../export/exportBOM'

interface ToolbarProps {
  nodes: Node[]
  edges: Edge[]
  onClearCanvas: () => void
  onFitView: () => void
  nodeCount: number
  edgeCount: number
  errorCount: number
  warningCount: number
}

export function Toolbar({
  nodes, edges,
  onClearCanvas, onFitView,
  nodeCount, edgeCount, errorCount, warningCount,
}: ToolbarProps) {
  const [exportOpen, setExportOpen] = useState(false)

  const handleExport = (type: 'json' | 'arduino' | 'bom' | 'netlist') => {
    setExportOpen(false)
    if (type === 'json')    downloadJSON(nodes, edges)
    if (type === 'arduino') downloadArduinoSketch(nodes, edges)
    if (type === 'bom')     downloadBOM(nodes, edges)
    if (type === 'netlist') downloadNetlist(nodes, edges)
  }

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

      {/* Clear canvas */}
      <button
        onClick={onClearCanvas}
        className="btn-secondary text-red-400/80 hover:text-red-400"
        title="Clear canvas"
      >
        <Trash2 size={12} />
        <span className="hidden sm:inline">Clear</span>
      </button>

      {/* Export dropdown */}
      <div className="relative">
        <button
          onClick={() => setExportOpen(!exportOpen)}
          className="btn-primary"
          id="export-btn"
        >
          <Download size={12} />
          Export
          <ChevronDown
            size={10}
            style={{ transform: exportOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          />
        </button>

        {exportOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setExportOpen(false)}
            />

            {/* Dropdown */}
            <div
              className="absolute right-0 top-full mt-2 w-56 rounded-xl overflow-hidden z-50"
              style={{
                background: 'rgba(15,23,42,0.98)',
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 16px 48px rgba(0,0,0,0.6)',
                backdropFilter: 'blur(12px)',
              }}
            >
              <div className="p-1.5 space-y-0.5">
                <ExportItem
                  icon={<FileJson size={13} className="text-indigo-400" />}
                  label="Schematic JSON"
                  desc="Full project data"
                  onClick={() => handleExport('json')}
                  id="export-json"
                />
                <ExportItem
                  icon={<Code2 size={13} className="text-green-400" />}
                  label="Arduino Sketch (.ino)"
                  desc="Wire.h setup + sensor code"
                  onClick={() => handleExport('arduino')}
                  id="export-arduino"
                />
                <ExportItem
                  icon={<Table2 size={13} className="text-amber-400" />}
                  label="Bill of Materials (CSV)"
                  desc="Component list + suppliers"
                  onClick={() => handleExport('bom')}
                  id="export-bom"
                />
                <ExportItem
                  icon={<Network size={13} className="text-blue-400" />}
                  label="Netlist (CSV)"
                  desc="EasyEDA-compatible"
                  onClick={() => handleExport('netlist')}
                  id="export-netlist"
                />
              </div>
            </div>
          </>
        )}
      </div>
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

function ExportItem({
  icon, label, desc, onClick, id,
}: {
  icon: React.ReactNode
  label: string
  desc: string
  onClick: () => void
  id: string
}) {
  return (
    <button
      id={id}
      onClick={onClick}
      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors text-left group"
    >
      <div className="flex-shrink-0">{icon}</div>
      <div>
        <div className="text-[10px] font-medium text-white/80 group-hover:text-white/100 transition-colors">
          {label}
        </div>
        <div className="text-[8px] text-white/35">{desc}</div>
      </div>
    </button>
  )
}
