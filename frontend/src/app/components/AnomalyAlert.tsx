import { useEffect, useState } from "react";
import { X, AlertTriangle } from "lucide-react";

interface AnomalyAlertProps {
  line: string;
  achieve: number;
  reason: string;
  onClose: () => void;
}

export function AnomalyAlert({ line, achieve, reason, onClose }: AnomalyAlertProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-card rounded-2xl shadow-2xl border-2 border-red-500 max-w-md w-full overflow-hidden animate-in zoom-in-95">
        <div
          className="p-4 flex items-center justify-between text-white"
          style={{ background: "var(--error-red)" }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <div>
              <h3 className="font-bold text-lg">Anomaly Detected!</h3>
              <div className="text-xs opacity-90">Production threshold breach detected</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">Production Line</div>
            <div className="text-2xl font-bold text-foreground">{line}</div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Current Achievement</div>
            <div className="text-3xl font-bold" style={{ color: "var(--error-red)" }}>
              {achieve}%
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Issue Detected</div>
            <div className="text-foreground">{reason}</div>
          </div>

          <div
            className="p-3 rounded-lg text-sm border-l-4"
            style={{
              background: "var(--accent)",
              color: "var(--foreground)",
              borderLeftColor: "var(--error-red)"
            }}
          >
            <div className="font-medium mb-1">⚠️ Immediate attention required</div>
            <div className="text-xs text-muted-foreground">
              Predictive analysis indicates target will be missed without intervention.
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-accent rounded">
            This alert appears automatically when production thresholds are breached.
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-lg"
            style={{ background: "var(--gradient-warm)" }}
          >
            Acknowledge & Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}

export function useAnomalyDetection() {
  const [anomaly, setAnomaly] = useState<{
    line: string;
    achieve: number;
    reason: string;
  } | null>(null);

  useEffect(() => {
    const checkForAnomalies = () => {
      const random = Math.random();
      if (random < 0.1) {
        setAnomaly({
          line: "Line 4",
          achieve: 76,
          reason: "Production rate 18% below threshold. Possible equipment delay detected.",
        });
      }
    };

    const interval = setInterval(checkForAnomalies, 30000);
    return () => clearInterval(interval);
  }, []);

  const clearAnomaly = () => setAnomaly(null);

  return { anomaly, clearAnomaly };
}
