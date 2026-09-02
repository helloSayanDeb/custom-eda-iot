import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { PassiveNodeData } from '../types'
import { SIGNAL_COLORS } from '../data/components'

export const PassiveNode = memo(function PassiveNode({ data, id, selected }: NodeProps) {
  const nodeData = data as unknown as PassiveNodeData
  const isResistor = nodeData.typeId?.startsWith('resistor')
  const isCap      = nodeData.typeId?.startsWith('cap')

  const p1Color = isCap ? SIGNAL_COLORS['POWER_3V3'] : SIGNAL_COLORS['NC']
  const p2Color = isCap ? SIGNAL_COLORS['GND'] : SIGNAL_COLORS['NC']

  return (
    <div
      className="relative select-none"
      style={{
        width: 140,
        height: 60,
        background: 'linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.95))',
        border: `1px solid ${selected ? '#6366f1' : 'rgba(255,255,255,0.12)'}`,
        borderRadius: '8px',
        backdropFilter: 'blur(8px)',
        boxShadow: selected
          ? '0 0 20px rgba(99,102,241,0.4)'
          : '0 4px 12px rgba(0,0,0,0.4)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Symbol */}
      <div className="flex flex-col items-center gap-0.5">
        <div className="text-base leading-none">
          {isResistor ? '⟿' : isCap ? '⊣⊢' : '○'}
        </div>
        <div className="text-[10px] font-mono font-semibold text-white/80">
          {nodeData.value}
        </div>
        <div className="text-[8px] text-white/40">
          {isResistor ? 'Resistor' : isCap ? 'Capacitor' : 'Passive'}
        </div>
      </div>

      {/* Left Handle (Pin 1) */}
      <div style={{ position: 'absolute', left: -5, top: '50%', transform: 'translateY(-50%)' }}>
        <div
          className="absolute text-[8px] font-mono"
          style={{ left: 14, top: '50%', transform: 'translateY(-50%)', color: p1Color, whiteSpace: 'nowrap' }}
        >
          {isCap ? 'VCC' : 'Pin1'}
        </div>
        <Handle
          type="target"
          position={Position.Left}
          id={`${id}__p1`}
          style={{
            background: p1Color,
            border: '2px solid rgba(255,255,255,0.3)',
            width: 10,
            height: 10,
            position: 'relative',
            top: 'auto', left: 'auto', right: 'auto', bottom: 'auto',
            transform: 'none',
          }}
        />
        <Handle
          type="source"
          position={Position.Left}
          id={`${id}__p1_s`}
          style={{
            background: 'transparent', border: 'none', width: 10, height: 10,
            position: 'absolute', opacity: 0, top: 0, left: 0,
          }}
        />
      </div>

      {/* Right Handle (Pin 2) */}
      <div style={{ position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)' }}>
        <div
          className="absolute text-[8px] font-mono"
          style={{ right: 14, top: '50%', transform: 'translateY(-50%)', color: p2Color, whiteSpace: 'nowrap' }}
        >
          {isCap ? 'GND' : 'Pin2'}
        </div>
        <Handle
          type="source"
          position={Position.Right}
          id={`${id}__p2`}
          style={{
            background: p2Color,
            border: '2px solid rgba(255,255,255,0.3)',
            width: 10,
            height: 10,
            position: 'relative',
            top: 'auto', left: 'auto', right: 'auto', bottom: 'auto',
            transform: 'none',
          }}
        />
        <Handle
          type="target"
          position={Position.Right}
          id={`${id}__p2_t`}
          style={{
            background: 'transparent', border: 'none', width: 10, height: 10,
            position: 'absolute', opacity: 0, top: 0, right: 0,
          }}
        />
      </div>
    </div>
  )
})
