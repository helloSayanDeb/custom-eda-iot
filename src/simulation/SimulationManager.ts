type SimMessageHandler = (msg: any) => void;

export class SimulationManager {
  private worker: Worker | null = null;
  private onMessage: SimMessageHandler | null = null;
  public isReady: boolean = false;

  constructor(onMessage: SimMessageHandler) {
    this.onMessage = onMessage;
    // Vite handles worker URLs nicely
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    
    this.worker.onmessage = (e) => {
      if (e.data.type === 'READY') {
        this.isReady = true;
      }
      if (this.onMessage) {
        this.onMessage(e.data);
      }
    };

    // Initialize pyodide
    this.worker.postMessage({ type: 'INIT' });
  }

  public runCode(code: string) {
    if (!this.worker || !this.isReady) return;
    this.worker.postMessage({ type: 'RUN', code });
  }

  public updateSensor(address: number, sensorData: Record<string, number>) {
    if (!this.worker) return;
    this.worker.postMessage({ type: 'UPDATE_MOCK', data: { address, sensorData } });
  }

  public terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}
