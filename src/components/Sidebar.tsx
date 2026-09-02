import { useState, useMemo } from 'react'
import { Search, ChevronDown, ChevronRight, Cpu, Radio, Zap, Settings } from 'lucide-react'
import { COMPONENT_LIBRARY, CATEGORY_CONFIG, SIGNAL_COLORS } from '../data/components'
import type { ComponentDefinition } from '../types'

interface SidebarProps {
  onDragStart: (e: React.DragEvent, def: ComponentDefinition) => void
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  MCU:       <Cpu size={12} />,
  Sensor:    <Radio size={12} />,
  Power:     <Zap size={12} />,
  Passive:   <Settings size={12} />,
  Connector: <span className="text-xs">🔌</span>,
}

export function Sidebar({ onDragStart }: SidebarProps) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const grouped = useMemo(() => {
    const filtered = COMPONENT_LIBRARY.filter(c =>
      search === '' ||
      c.label.toLowerCase().includes(search.toLowerCase()) ||
      c.shortLabel.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
    )

    const groups: Record<string, ComponentDefinition[]> = {}
    filtered.forEach(c => {
      if (!groups[c.category]) groups[c.category] = []
      groups[c.category].push(c)
    })

    return Object.entries(groups).sort(
      ([a], [b]) => (CATEGORY_CONFIG[a]?.order ?? 99) - (CATEGORY_CONFIG[b]?.order ?? 99)
    )
  }, [search])

  const toggleCategory = (cat: string) => {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  return (
    <aside
      className="flex flex-col h-full select-none"
      style={{
        width: 260,
        background: 'rgba(9,14,28,0.97)',
        borderRight: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-sm"
            style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
          >
            🧩
          </div>
          <div>
            <div className="text-xs font-semibold text-white/90">Component Palette</div>
            <div className="text-[9px] text-white/40">{COMPONENT_LIBRARY.length} components</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs rounded-lg outline-none transition-all"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: 'rgba(255,255,255,0.8)',
            }}
            onFocus={e => { e.target.style.border = '1px solid rgba(99,102,241,0.5)' }}
            onBlur={e => { e.target.style.border = '1px solid rgba(255,255,255,0.1)' }}
          />
        </div>
      </div>

      {/* Drag hint */}
      <div className="px-4 py-2 border-b border-white/5">
        <p className="text-[9px] text-white/30 text-center">
          ↕ Drag components onto the canvas
        </p>
      </div>

      {/* Component groups */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {grouped.length === 0 && (
          <div className="text-center py-8 text-white/30 text-xs">
            No components found
          </div>
        )}

        {grouped.map(([category, components]) => {
          const catConfig = CATEGORY_CONFIG[category]
          const isCollapsed = collapsed[category]

          return (
            <div key={category}>
              {/* Category header */}
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors group"
              >
                <span style={{ color: catConfig?.color ?? '#6366f1' }}>
                  {CATEGORY_ICONS[category] ?? '•'}
                </span>
                <span className="text-[10px] font-semibold text-white/60 group-hover:text-white/80 uppercase tracking-wider flex-1 text-left">
                  {category}
                </span>
                <span className="text-[9px] text-white/30">{components.length}</span>
                {isCollapsed
                  ? <ChevronRight size={10} className="text-white/30" />
                  : <ChevronDown size={10} className="text-white/30" />
                }
              </button>

              {/* Component cards */}
              {!isCollapsed && (
                <div className="mt-1 space-y-1 pl-1">
                  {components.map(def => (
                    <ComponentCard
                      key={def.typeId}
                      def={def}
                      onDragStart={onDragStart}
                    />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Signal legend */}
      <div className="px-3 py-3 border-t border-white/5">
        <div className="text-[9px] font-semibold text-white/30 uppercase tracking-wider mb-2">
          Signal Legend
        </div>
        <div className="grid grid-cols-2 gap-x-2 gap-y-1">
          {(
            [
              ['POWER_3V3', '3.3V'],
              ['GND', 'GND'],
              ['SDA', 'SDA'],
              ['SCL', 'SCL'],
              ['GPIO', 'GPIO'],
              ['INT', 'INT'],
            ] as const
          ).map(([sig, label]) => (
            <div key={sig} className="flex items-center gap-1.5">
              <div
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ background: SIGNAL_COLORS[sig] }}
              />
              <span className="text-[9px] text-white/50 font-mono">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}

// ─── Individual Component Card ────────────────────────────────────────────────
function ComponentCard({
  def,
  onDragStart,
}: {
  def: ComponentDefinition
  onDragStart: (e: React.DragEvent, def: ComponentDefinition) => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, def)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="component-card rounded-xl p-2.5 cursor-grab active:cursor-grabbing"
      style={{
        background: hovered
          ? `linear-gradient(135deg, rgba(15,23,42,0.9), ${def.color}18)`
          : 'rgba(15,23,42,0.6)',
        border: `1px solid ${hovered ? def.color + '40' : 'rgba(255,255,255,0.07)'}`,
        transition: 'all 0.2s cubic-bezier(0.34,1.56,0.64,1)',
        transform: hovered ? 'translateY(-2px) scale(1.02)' : 'none',
        boxShadow: hovered ? `0 4px 16px ${def.color}30` : 'none',
      }}
    >
      <div className="flex items-start gap-2">
        {/* Icon */}
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center text-sm flex-shrink-0"
          style={{
            background: `${def.color}20`,
            border: `1px solid ${def.color}30`,
          }}
        >
          {def.icon}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold text-white/85 truncate leading-tight">
            {def.shortLabel}
          </div>
          <div className="text-[8px] text-white/40 truncate mt-0.5 leading-tight">
            {def.description.split('.')[0].slice(0, 50)}
          </div>

          {/* I2C addresses */}
          {def.i2cAddresses.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {def.i2cAddresses.map(addr => (
                <span
                  key={addr.hex}
                  className="text-[7px] font-mono px-1 py-0.5 rounded"
                  style={{
                    background: addr.hex === '0x53' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)',
                    color: addr.hex === '0x53' ? '#fbbf24' : '#818cf8',
                  }}
                >
                  {addr.hex}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
