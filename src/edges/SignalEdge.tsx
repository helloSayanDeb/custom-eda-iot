import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  type EdgeProps,
} from '@xyflow/react'
import type { SignalEdgeData } from '../types'
import { SIGNAL_COLORS, SIGNAL_LABELS } from '../data/components'

export const SignalEdge = memo(function SignalEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data, selected, label,
}: EdgeProps) {
  const edgeData = data as SignalEdgeData | undefined
  const signal   = edgeData?.signal ?? 'NC'
  const color    = SIGNAL_COLORS[signal] ?? '#6b7280'
  const isI2C    = signal === 'SDA' || signal === 'SCL'
  const isPower  = signal === 'POWER_3V3' || signal === 'POWER_5V' || signal === 'GND'
  const isError  = signal === 'POWER_5V'

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
    borderRadius: 12,
  })

  const strokeWidth = isPower ? 2.5 : isI2C ? 2 : 1.5
  const displayColor = isError ? '#ef4444' : selected ? '#fff' : color

  return (
    <>
      {/* Glow effect for I2C lines */}
      {isI2C && (
        <path
          d={edgePath}
          stroke={color}
          strokeWidth={6}
          fill="none"
          opacity={0.15}
          style={{ pointerEvents: 'none' }}
        />
      )}

      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: displayColor,
          strokeWidth,
          strokeDasharray: isI2C ? '6 3' : isPower ? 'none' : 'none',
          animation: isI2C ? 'dash-flow 0.6s linear infinite' : 'none',
          filter: selected ? `drop-shadow(0 0 4px ${color})` : 'none',
          opacity: 0.9,
        }}
        markerEnd={`url(#arrow-${signal})`}
      />

      {/* Edge Label */}
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan absolute pointer-events-none"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            zIndex: 10,
          }}
        >
          {(selected || edgeData?.label) && (
            <div
              className="text-[8px] font-mono font-medium px-1.5 py-0.5 rounded whitespace-nowrap"
              style={{
                background: 'rgba(2,6,23,0.85)',
                color: displayColor,
                border: `1px solid ${displayColor}40`,
                backdropFilter: 'blur(4px)',
              }}
            >
              {edgeData?.label ?? SIGNAL_LABELS[signal] ?? signal}
            </div>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
})
