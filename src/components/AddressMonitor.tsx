import type { I2CBusEntry } from '../validation/drc'
import { AlertTriangle, CheckCircle } from 'lucide-react'

interface AddressMonitorProps {
  entries: I2CBusEntry[]
  mcuConnected: boolean
}

export function AddressMonitor({ entries, mcuConnected }: AddressMonitorProps) {
  const hasConflicts = entries.some(e => e.isConflict)

  return (
    <div className="px-2 py-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-2 mb-3">
        <div
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs"
          style={{
            background: hasConflicts ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.15)',
            border: hasConflicts ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(34,197,94,0.25)',
          }}
        >
          📡
        </div>
        <div>
          <div className="text-[10px] font-semibold text-white/80">I2C Bus Monitor</div>
          <div className="text-[8px] text-white/40">
            {entries.length} device{entries.length !== 1 ? 's' : ''} • {mcuConnected ? 'MCU on bus' : 'No MCU'}
          </div>
        </div>
      </div>

      {/* Bus diagram */}
      <div
        className="rounded-xl p-3 mb-3"
        style={{
          background: 'rgba(0,0,0,0.3)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* SDA rail */}
        <div className="flex items-center gap-2 mb-1.5">
          <div
            className="text-[8px] font-mono font-semibold w-8"
            style={{ color: '#3b82f6' }}
          >
            SDA
          </div>
          <div
            className="flex-1 h-0.5 relative"
            style={{
              background: 'linear-gradient(90deg, #3b82f6, #3b82f640)',
              boxShadow: '0 0 6px rgba(59,130,246,0.5)',
            }}
          >
            {/* Animated dots for I2C bus activity */}
            <div
              className="absolute inset-0"
              style={{
                background: 'repeating-linear-gradient(90deg, #3b82f6 0, #3b82f6 4px, transparent 4px, transparent 12px)',
                backgroundSize: '16px',
                animation: 'dash-flow 0.5s linear infinite',
              }}
            />
          </div>
        </div>

        {/* SCL rail */}
        <div className="flex items-center gap-2">
          <div
            className="text-[8px] font-mono font-semibold w-8"
            style={{ color: '#eab308' }}
          >
            SCL
          </div>
          <div
            className="flex-1 h-0.5 relative"
            style={{
              background: 'linear-gradient(90deg, #eab308, #eab30840)',
              boxShadow: '0 0 6px rgba(234,179,8,0.5)',
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                background: 'repeating-linear-gradient(90deg, #eab308 0, #eab308 4px, transparent 4px, transparent 12px)',
                backgroundSize: '16px',
                animation: 'dash-flow 0.5s linear infinite',
              }}
            />
          </div>
        </div>

        {/* MCU indicator */}
        <div className="mt-2 flex items-center gap-1.5">
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: mcuConnected ? '#22c55e' : '#6b7280' }}
          />
          <span className="text-[8px] text-white/40">
            XIAO BLE D4(SDA) / D5(SCL) — {mcuConnected ? 'Connected' : 'Not on bus'}
          </span>
        </div>
      </div>

      {/* Address table */}
      {entries.length === 0 ? (
        <div className="text-center py-4">
          <div className="text-[9px] text-white/30">
            Drop I2C sensors on the canvas to see addresses
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {entries.map((entry, idx) => (
            <div
              key={`${entry.hex}-${entry.nodeId}-${idx}`}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
              style={{
                background: entry.isConflict
                  ? 'rgba(239,68,68,0.08)'
                  : 'rgba(255,255,255,0.03)',
                border: entry.isConflict
                  ? '1px solid rgba(239,68,68,0.25)'
                  : '1px solid rgba(255,255,255,0.06)',
              }}
            >
              {/* Address hex badge */}
              <div
                className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded flex-shrink-0"
                style={{
                  background: entry.isConflict
                    ? 'rgba(239,68,68,0.2)'
                    : entry.hex === '0x38'
                    ? 'rgba(16,185,129,0.15)'
                    : 'rgba(99,102,241,0.15)',
                  color: entry.isConflict
                    ? '#f87171'
                    : entry.hex === '0x38'
                    ? '#34d399'
                    : '#a78bfa',
                  minWidth: 36,
                  textAlign: 'center',
                }}
              >
                {entry.hex}
              </div>

              {/* Device info */}
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-medium text-white/80 truncate">
                  {entry.shortLabel}
                </div>
                {entry.condition && (
                  <div
                    className="text-[7px] truncate"
                    style={{ color: entry.isConflict ? '#fca5a5' : 'rgba(255,255,255,0.35)' }}
                  >
                    {entry.condition}
                  </div>
                )}
              </div>

              {/* Status icon */}
              {entry.isConflict ? (
                <AlertTriangle size={10} className="text-red-400 flex-shrink-0" />
              ) : (
                <CheckCircle size={10} className="text-green-500/50 flex-shrink-0" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Conflict summary */}
      {hasConflicts && (
        <div
          className="mt-3 rounded-xl p-2.5"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <div className="text-[9px] font-semibold text-red-400 mb-1">
            ⚠️ Address Conflict Detected
          </div>
          <div className="text-[8px] text-red-300/60 leading-relaxed">
            LTR-390 address (0x53) is FIXED. Set ENS160 ADDR pin LOW to use 0x52.
          </div>
        </div>
      )}
    </div>
  )
}
