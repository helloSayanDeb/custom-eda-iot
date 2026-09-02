import { memo, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { ComponentNodeData, PinDefinition } from '../types'
import { SIGNAL_COLORS } from '../data/components'

// ─── Pin handle component ─────────────────────────────────────────────────────
interface PinHandleProps {
  pin: PinDefinition
  nodeId: string
  side: 'left' | 'right'
}

function PinHandle({ pin, nodeId, side }: PinHandleProps) {
  const [hovered, setHovered] = useState(false)
  const handleId = `${nodeId}__${pin.id}`
  const color = SIGNAL_COLORS[pin.signal] ?? '#6b7280'

  return (
    <div
      className="relative"
      style={{
        position: 'absolute',
        [side === 'left' ? 'left' : 'right']: '-5px',
        top: `${pin.position * 100}%`,
        transform: 'translateY(-50%)',
        display: 'flex',
        alignItems: 'center',
        zIndex: 10,
      }}
    >
      {/* Pin label */}
      <div
        className={`absolute text-[9px] font-mono font-medium pointer-events-none whitespace-nowrap transition-all duration-150 ${
          hovered ? 'opacity-100 scale-105' : 'opacity-70'
        }`}
        style={{
          [side === 'left' ? 'left' : 'right']: '14px',
          color,
          textShadow: '0 0 8px rgba(0,0,0,0.8)',
          zIndex: 20,
        }}
      >
        {pin.label}
      </div>

      {/* React Flow Handle */}
      <Handle
        type={side === 'left' ? 'target' : 'source'}
        position={side === 'left' ? Position.Left : Position.Right}
        id={handleId}
        style={{
          background: color,
          border: `2px solid ${hovered ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)'}`,
          width: 10,
          height: 10,
          borderRadius: '50%',
          cursor: 'crosshair',
          boxShadow: hovered ? `0 0 8px ${color}` : `0 0 4px ${color}40`,
          transition: 'all 0.15s ease',
          position: 'relative',
          top: 'auto',
          left: 'auto',
          right: 'auto',
          bottom: 'auto',
          transform: 'none',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />

      {/* Also add source on left side and target on right (bidirectional) */}
      <Handle
        type={side === 'left' ? 'source' : 'target'}
        position={side === 'left' ? Position.Left : Position.Right}
        id={`${handleId}_bi`}
        style={{
          background: 'transparent',
          border: 'none',
          width: 10,
          height: 10,
          position: 'absolute',
          opacity: 0,
          cursor: 'crosshair',
        }}
      />
    </div>
  )
}

// ─── Component Node ────────────────────────────────────────────────────────────
export const ComponentNode = memo(function ComponentNode({ data, id, selected }: NodeProps) {
  const nodeData = data as ComponentNodeData
  const { componentDef } = nodeData

  const hasErrors   = nodeData.drcErrors?.length > 0
  const hasWarnings = nodeData.drcWarnings?.length > 0

  const accentColor = componentDef.color
  const leftPins  = componentDef.pins.filter(p => p.side === 'left')
  const rightPins = componentDef.pins.filter(p => p.side === 'right')

  const borderColor = hasErrors
    ? '#ef4444'
    : hasWarnings
    ? '#f59e0b'
    : selected
    ? '#6366f1'
    : 'rgba(255,255,255,0.1)'

  const glowColor = hasErrors
    ? '0 0 20px rgba(239,68,68,0.4)'
    : hasWarnings
    ? '0 0 16px rgba(245,158,11,0.3)'
    : selected
    ? '0 0 24px rgba(99,102,241,0.5)'
    : '0 4px 16px rgba(0,0,0,0.5)'

  return (
    <div
      className={`relative select-none ${hasErrors ? 'node-error' : hasWarnings ? 'node-warning' : ''}`}
      style={{
        width: componentDef.width,
        minHeight: componentDef.height,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95) 0%, rgba(30,41,59,0.95) 100%)',
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        backdropFilter: 'blur(12px)',
        boxShadow: glowColor,
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {/* Top accent stripe */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor}40)`,
          borderRadius: '12px 12px 0 0',
        }}
      />

      {/* Header */}
      <div className="pt-4 px-3 pb-2">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg leading-none">{componentDef.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-white/90 leading-tight truncate">
              {componentDef.shortLabel}
            </div>
            <div className="text-[9px] text-white/40 truncate">{componentDef.category}</div>
          </div>
          {/* Status dot */}
          {hasErrors ? (
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" title="DRC Error" />
          ) : hasWarnings ? (
            <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="DRC Warning" />
          ) : null}
        </div>

        {/* I2C Addresses */}
        {componentDef.i2cAddresses.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {componentDef.i2cAddresses.map(addr => (
              <span
                key={addr.hex}
                className="text-[8px] font-mono px-1.5 py-0.5 rounded"
                style={{
                  background: addr.hex === '0x53' ? 'rgba(245,158,11,0.2)' : 'rgba(99,102,241,0.2)',
                  color: addr.hex === '0x53' ? '#fbbf24' : '#a78bfa',
                  border: `1px solid ${addr.hex === '0x53' ? 'rgba(245,158,11,0.3)' : 'rgba(99,102,241,0.3)'}`,
                }}
              >
                {addr.hex}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Pin area */}
      <div
        className="relative mx-2 mb-2 rounded-lg"
        style={{
          background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.06)',
          minHeight: Math.max(leftPins.length, rightPins.length) * 20 + 16,
        }}
      >
        {/* Center chip symbol */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ opacity: 0.15 }}
        >
          <div
            className="text-2xl"
            style={{ color: accentColor }}
          >
            {componentDef.icon}
          </div>
        </div>
      </div>

      {/* Pin Handles — rendered relative to parent node container */}
      {leftPins.map(pin => (
        <PinHandle key={pin.id} pin={pin} nodeId={id} side="left" />
      ))}
      {rightPins.map(pin => (
        <PinHandle key={pin.id} pin={pin} nodeId={id} side="right" />
      ))}

      {/* Error badge */}
      {(hasErrors || hasWarnings) && (
        <div
          className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
          style={{
            background: hasErrors ? '#ef4444' : '#f59e0b',
            color: 'white',
            boxShadow: `0 0 8px ${hasErrors ? '#ef444480' : '#f59e0b80'}`,
          }}
        >
          {(nodeData.drcErrors?.length ?? 0) + (nodeData.drcWarnings?.length ?? 0)}
        </div>
      )}
    </div>
  )
})
