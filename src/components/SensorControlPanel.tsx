import { useState } from 'react';
import type { ComponentNodeData } from '../types';

interface SensorControlPanelProps {
  nodes: { id: string, data: ComponentNodeData }[];
  onSensorDataChange: (address: number, data: Record<string, number>) => void;
}

/**
 * Your exact sensor addresses (from block diagram):
 *   MAX30102 → 0x57
 *   MPU-6050 → 0x68
 *   TMP117   → 0x48
 *   ENS160   → 0x52
 *   AHT21    → 0x38
 *   LTR-390  → 0x53
 */
export function SensorControlPanel({ nodes, onSensorDataChange }: SensorControlPanelProps) {
  const [v, setV] = useState<Record<string, number>>({
    // MAX30102
    'hr': 72,
    'spo2': 98,
    // MPU-6050
    'accelX': 0,
    'accelY': 0,
    'accelZ': 9.8,
    // TMP117
    'skinTemp': 36.5,
    // ENS160
    'aqi': 1,
    'tvoc': 50,
    'eco2': 400,
    // AHT21
    'humidity': 50,
    'ahtTemp': 25,
    // LTR-390
    'uvIndex': 2,
    'lux': 500,
  });

  const set = (key: string, val: number, addr: number, field: string) => {
    setV(prev => ({ ...prev, [key]: val }));
    onSensorDataChange(addr, { [field]: val });
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1117] border-r border-white/10 w-[300px]">
      <div className="p-4 border-b border-white/10 bg-[#161b22]">
        <h2 className="text-sm font-semibold text-white/90">🧪 Sensor Test Data</h2>
        <p className="text-[10px] text-white/50 mt-1">
          Inject live data into the I2C mock registers for your hardware.
        </p>
      </div>

      <div className="p-3 overflow-y-auto space-y-3 flex-1 pb-[42vh]">
        {/* ── MAX30102 ── */}
        <Card title="MAX30102" subtitle="Heart Rate / SpO₂" addr="0x57" accent="border-red-500/30">
          <Slider label="Heart Rate" unit="BPM" value={v.hr} min={30} max={200} step={1}
            color="text-red-400" onChange={n => set('hr', n, 0x57, 'heartRate')} />
          <Slider label="SpO₂" unit="%" value={v.spo2} min={70} max={100} step={1}
            color="text-blue-400" onChange={n => set('spo2', n, 0x57, 'spo2')} />
        </Card>

        {/* ── MPU-6050 ── */}
        <Card title="MPU-6050" subtitle="6-Axis IMU" addr="0x68" accent="border-violet-500/30">
          <Slider label="Accel X" unit="m/s²" value={v.accelX} min={-20} max={20} step={0.1}
            color="text-violet-400" onChange={n => set('accelX', n, 0x68, 'accelX')} />
          <Slider label="Accel Y" unit="m/s²" value={v.accelY} min={-20} max={20} step={0.1}
            color="text-violet-400" onChange={n => set('accelY', n, 0x68, 'accelY')} />
          <Slider label="Accel Z" unit="m/s²" value={v.accelZ} min={-20} max={20} step={0.1}
            color="text-violet-400" onChange={n => set('accelZ', n, 0x68, 'accelZ')} />
        </Card>

        {/* ── TMP117 ── */}
        <Card title="TMP117" subtitle="Skin Temperature" addr="0x48" accent="border-orange-500/30">
          <Slider label="Temperature" unit="°C" value={v.skinTemp} min={20} max={45} step={0.1}
            color="text-orange-400" onChange={n => set('skinTemp', n, 0x48, 'temperature')} />
        </Card>

        {/* ── ENS160 ── */}
        <Card title="ENS160" subtitle="Air Quality" addr="0x52" accent="border-emerald-500/30">
          <Slider label="AQI" unit="" value={v.aqi} min={1} max={5} step={1}
            color="text-emerald-400" onChange={n => set('aqi', n, 0x52, 'aqi')} />
          <Slider label="TVOC" unit="ppb" value={v.tvoc} min={0} max={5000} step={10}
            color="text-emerald-400" onChange={n => set('tvoc', n, 0x52, 'tvoc')} />
          <Slider label="eCO₂" unit="ppm" value={v.eco2} min={400} max={8000} step={50}
            color="text-emerald-400" onChange={n => set('eco2', n, 0x52, 'eco2')} />
        </Card>

        {/* ── AHT21 ── */}
        <Card title="AHT21" subtitle="Humidity + Temp" addr="0x38" accent="border-cyan-500/30">
          <Slider label="Humidity" unit="%RH" value={v.humidity} min={0} max={100} step={1}
            color="text-cyan-400" onChange={n => set('humidity', n, 0x38, 'humidity')} />
          <Slider label="Temperature" unit="°C" value={v.ahtTemp} min={-20} max={60} step={0.5}
            color="text-cyan-400" onChange={n => set('ahtTemp', n, 0x38, 'temperature')} />
        </Card>

        {/* ── LTR-390 ── */}
        <Card title="LTR-390" subtitle="UV + Ambient Light" addr="0x53" accent="border-purple-500/30">
          <Slider label="UV Index" unit="" value={v.uvIndex} min={0} max={15} step={0.1}
            color="text-purple-400" onChange={n => set('uvIndex', n, 0x53, 'uvIndex')} />
          <Slider label="Ambient Light" unit="lux" value={v.lux} min={0} max={100000} step={100}
            color="text-purple-400" onChange={n => set('lux', n, 0x53, 'lux')} />
        </Card>
      </div>
    </div>
  );
}

// ── Reusable components ──────────────────────────────────────────

function Card({ title, subtitle, addr, accent, children }: {
  title: string; subtitle: string; addr: string; accent?: string; children: React.ReactNode;
}) {
  return (
    <div className={`bg-white/[0.03] p-3 rounded-lg border ${accent || 'border-white/10'}`}>
      <div className="flex items-center justify-between mb-2">
        <div>
          <span className="text-xs font-semibold text-white/85">{title}</span>
          <span className="text-[9px] text-white/40 ml-1.5">{subtitle}</span>
        </div>
        <span className="text-[9px] font-mono text-white/25 bg-white/5 px-1.5 py-0.5 rounded">{addr}</span>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function Slider({ label, unit, value, min, max, step, onChange, color = 'text-white/70' }: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; color?: string;
}) {
  const display = step < 1 ? value.toFixed(1) : String(value);
  return (
    <div>
      <label className={`text-[10px] ${color} flex justify-between mb-0.5`}>
        <span>{label}</span>
        <span className="font-mono text-white/80">{display}{unit ? ` ${unit}` : ''}</span>
      </label>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full h-1 rounded-full appearance-none bg-white/10 accent-blue-500 cursor-pointer"
      />
    </div>
  );
}
