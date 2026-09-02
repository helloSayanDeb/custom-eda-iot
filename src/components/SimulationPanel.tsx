import { useState, useEffect, useRef } from 'react';
import Editor from '@monaco-editor/react';
import { SimulationManager } from '../simulation/SimulationManager';
import { Play, Square, Terminal as TerminalIcon } from 'lucide-react';

interface SimulationPanelProps {
  simManager: SimulationManager | null;
  onRun: (code: string) => void;
  onStop: () => void;
  isRunning: boolean;
  terminalOutput: string;
}

export function SimulationPanel({ simManager, onRun, onStop, isRunning, terminalOutput }: SimulationPanelProps) {
  const [code, setCode] = useState<string>(`import board
import busio
import time
import adafruit_tmp117
import adafruit_mpu6050

print("Initializing I2C...")
i2c = busio.I2C(board.SCL, board.SDA)

try:
    tmp = adafruit_tmp117.TMP117(i2c)
    print("TMP117 Found!")
except Exception as e:
    print("TMP117 Error:", e)

try:
    mpu = adafruit_mpu6050.MPU6050(i2c)
    print("MPU6050 Found!")
except Exception as e:
    print("MPU6050 Error:", e)

for i in range(5):
    print("----- Reading", i, "-----")
    try:
        print("Temp:", tmp.temperature, "C")
    except: pass
    
    try:
        print("Accel:", mpu.acceleration)
    except: pass
    
    time.sleep(1)
print("Done!")
`);

  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalOutput]);

  return (
    <div className="absolute bottom-0 left-0 right-0 h-[40vh] bg-[#0d1117] border-t border-white/10 flex flex-col shadow-2xl z-40">
      {/* Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#161b22] border-b border-white/5">
        <div className="flex items-center gap-2 text-white/80 font-medium text-sm">
          <TerminalIcon size={16} />
          CircuitPython IDE
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button 
              onClick={() => onRun(code)}
              className="flex items-center gap-1.5 px-3 py-1 bg-green-600 hover:bg-green-500 text-white text-xs rounded transition-colors"
            >
              <Play size={14} /> Run Script
            </button>
          ) : (
            <button 
              onClick={onStop}
              className="flex items-center gap-1.5 px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded transition-colors"
            >
              <Square size={14} /> Stop
            </button>
          )}
        </div>
      </div>

      {/* Editor & Terminal Split */}
      <div className="flex flex-1 overflow-hidden">
        {/* Editor Area */}
        <div className="w-1/2 border-r border-white/5 relative">
          <Editor
            height="100%"
            language="python"
            theme="vs-dark"
            value={code}
            onChange={(val) => setCode(val || '')}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
              padding: { top: 16 }
            }}
          />
        </div>

        {/* Terminal Area */}
        <div 
          ref={terminalRef}
          className="w-1/2 p-4 overflow-y-auto font-mono text-[13px] leading-relaxed break-words"
          style={{ 
            color: '#c9d1d9', 
            backgroundColor: '#0d1117',
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace" 
          }}
        >
          {terminalOutput ? (
            <pre className="whitespace-pre-wrap m-0">{terminalOutput}</pre>
          ) : (
            <div className="text-white/30 italic">No output yet. Click 'Run Script' to execute CircuitPython in the browser.</div>
          )}
        </div>
      </div>
    </div>
  );
}
