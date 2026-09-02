import { useState } from 'react'
import { AlertTriangle, AlertCircle, Info, ChevronDown, ChevronRight, X } from 'lucide-react'
import type { DRCResult } from '../types'

interface ValidationPanelProps {
  results: DRCResult[]
  onHighlightNodes: (nodeIds: string[]) => void
}

export function ValidationPanel({ results, onHighlightNodes }: ValidationPanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'error' | 'warning' | 'info'>('all')

  const errors   = results.filter(r => r.severity === 'error')
  const warnings = results.filter(r => r.severity === 'warning')
  const infos    = results.filter(r => r.severity === 'info')

  const filtered =
    filter === 'all' ? results :
    filter === 'error' ? errors :
    filter === 'warning' ? warnings :
    infos

  const severityIcon = {
    error:   <AlertCircle size={12} className="text-red-400 flex-shrink-0" />,
    warning: <AlertTriangle size={12} className="text-amber-400 flex-shrink-0" />,
    info:    <Info size={12} className="text-blue-400 flex-shrink-0" />,
  }

  const severityColor = {
    error:   { bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', text: '#f87171' },
    warning: { bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', text: '#fbbf24' },
    info:    { bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)', text: '#60a5fa' },
  }

  return (
    <aside
      className="flex flex-col h-full"
      style={{
        width: 300,
        background: 'rgba(9,14,28,0.97)',
        borderLeft: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{
              background: errors.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
              border: errors.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.3)',
            }}
          >
            {errors.length > 0 ? '⚠' : '✓'}
          </div>
          <div>
            <div className="text-xs font-semibold text-white/90">DRC Results</div>
            <div className="text-[9px] text-white/40">Design Rule Check</div>
          </div>

          {/* Total badge */}
          {results.length > 0 && (
            <div
              className="ml-auto text-[9px] font-bold px-2 py-0.5 rounded-full"
              style={{
                background: errors.length > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                color: errors.length > 0 ? '#f87171' : '#fbbf24',
              }}
            >
              {results.length}
            </div>
          )}
        </div>

        {/* Severity filter tabs */}
        <div className="flex gap-1">
          {(['all', 'error', 'warning', 'info'] as const).map(f => {
            const count = f === 'all' ? results.length : f === 'error' ? errors.length : f === 'warning' ? warnings.length : infos.length
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="flex-1 text-[9px] font-medium py-1 rounded-md transition-all capitalize"
                style={{
                  background: active ? (
                    f === 'error' ? 'rgba(239,68,68,0.2)' :
                    f === 'warning' ? 'rgba(245,158,11,0.2)' :
                    f === 'info' ? 'rgba(59,130,246,0.2)' :
                    'rgba(255,255,255,0.1)'
                  ) : 'transparent',
                  color: active ? (
                    f === 'error' ? '#f87171' :
                    f === 'warning' ? '#fbbf24' :
                    f === 'info' ? '#60a5fa' :
                    'rgba(255,255,255,0.8)'
                  ) : 'rgba(255,255,255,0.4)',
                  border: active ? `1px solid ${
                    f === 'error' ? 'rgba(239,68,68,0.3)' :
                    f === 'warning' ? 'rgba(245,158,11,0.3)' :
                    f === 'info' ? 'rgba(59,130,246,0.3)' :
                    'rgba(255,255,255,0.15)'
                  }` : '1px solid transparent',
                }}
              >
                {f === 'all' ? `All (${count})` : `${count}`}
              </button>
            )
          })}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1.5">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-center">
            <div className="text-2xl mb-2">✅</div>
            <div className="text-xs font-medium text-white/60">
              {results.length === 0 ? 'No DRC issues found' : `No ${filter}s`}
            </div>
            <div className="text-[9px] text-white/30 mt-1">
              {results.length === 0 ? 'Connect components to run validation' : ''}
            </div>
          </div>
        )}

        {filtered.map(result => {
          const colors = severityColor[result.severity]
          const isExpanded = expandedId === result.id

          return (
            <div
              key={result.id}
              className="rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{
                background: colors.bg,
                border: `1px solid ${colors.border}`,
              }}
              onClick={() => {
                setExpandedId(isExpanded ? null : result.id)
                if (result.affectedNodeIds.length > 0) {
                  onHighlightNodes(result.affectedNodeIds)
                }
              }}
            >
              {/* Result header */}
              <div className="flex items-start gap-2 px-3 py-2.5">
                {severityIcon[result.severity]}
                <div className="flex-1 min-w-0">
                  <div className="text-[10px] font-medium leading-tight" style={{ color: colors.text }}>
                    {result.message}
                  </div>
                  {result.affectedNodeIds.length > 0 && (
                    <div className="text-[8px] text-white/30 mt-0.5">
                      {result.affectedNodeIds.length} node{result.affectedNodeIds.length > 1 ? 's' : ''} affected
                    </div>
                  )}
                </div>
                {isExpanded
                  ? <ChevronDown size={10} className="text-white/30 flex-shrink-0 mt-0.5" />
                  : <ChevronRight size={10} className="text-white/30 flex-shrink-0 mt-0.5" />
                }
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-white/5">
                  {result.detail && (
                    <p className="text-[9px] text-white/50 mt-2 leading-relaxed">
                      {result.detail}
                    </p>
                  )}
                  {result.suggestion && (
                    <div
                      className="rounded-lg p-2"
                      style={{ background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}
                    >
                      <div className="text-[8px] font-semibold text-indigo-400 mb-1">💡 Suggestion</div>
                      <div className="text-[9px] text-white/60 leading-relaxed">{result.suggestion}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Status bar */}
      <div
        className="px-4 py-2 border-t border-white/5 flex items-center gap-3"
        style={{ background: 'rgba(0,0,0,0.2)' }}
      >
        {errors.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
            <span className="text-[9px] text-red-400">{errors.length} error{errors.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {warnings.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            <span className="text-[9px] text-amber-400">{warnings.length} warning{warnings.length > 1 ? 's' : ''}</span>
          </div>
        )}
        {infos.length > 0 && (
          <div className="flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="text-[9px] text-blue-400">{infos.length} info</span>
          </div>
        )}
        {results.length === 0 && (
          <span className="text-[9px] text-green-400">✓ All clear</span>
        )}
      </div>
    </aside>
  )
}
