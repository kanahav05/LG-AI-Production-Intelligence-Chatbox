import { useEffect, useState, useCallback } from "react";
import { X, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { fetchLive } from "../../api";

// Alert data shape
interface AlertData {
  line: string;
  product: string;
  achieve: number;
  reason: string;
  detectedAt: Date;
}

// Alert overlay component
interface AnomalyAlertProps {
  alerts: AlertData[];
  onClose: () => void;
}

export function AnomalyAlert({ alerts, onClose }: AnomalyAlertProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  if (alerts.length === 0) return null;

  const current = alerts[currentIndex];
  const hasMultiple = alerts.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div className="bg-card rounded-2xl shadow-2xl border-2 border-red-500 max-w-md w-full overflow-hidden animate-in zoom-in-95">

        {/* Header */}
        <div
          className="p-4 flex items-center justify-between text-white"
          style={{ background: "var(--error-red)" }}
        >
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 animate-pulse" />
            <div>
              <h3 className="font-bold text-lg">Anomaly Detected!</h3>
              <div className="text-xs opacity-90">
                {alerts.length === 1
                  ? "Production threshold breach detected"
                  : `${alerts.length} lines below threshold`}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-white/20 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Multi-alert navigation */}
        {hasMultiple && (
          <div className="flex items-center justify-between px-6 pt-4">
            <button
              onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
              disabled={currentIndex === 0}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-muted-foreground font-medium">
              Alert {currentIndex + 1} of {alerts.length}
            </span>
            <button
              onClick={() => setCurrentIndex(i => Math.min(alerts.length - 1, i + 1))}
              disabled={currentIndex === alerts.length - 1}
              className="p-1 rounded hover:bg-accent disabled:opacity-30"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Alert content */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="text-sm text-muted-foreground mb-1">Production Line</div>
              <div className="text-2xl font-bold text-foreground">{current.line}</div>
              <div className="text-sm text-muted-foreground">{current.product}</div>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground mb-1">Achievement</div>
              <div className="text-3xl font-bold" style={{ color: "var(--error-red)" }}>
                {current.achieve.toFixed(1)}%
              </div>
              <div className="text-xs text-muted-foreground">threshold: 80%</div>
            </div>
          </div>

          <div>
            <div className="text-sm text-muted-foreground mb-1">Issue Detected</div>
            <div className="text-foreground text-sm">{current.reason}</div>
          </div>

          <div
            className="p-3 rounded-lg text-sm border-l-4"
            style={{
              background: "var(--accent)",
              borderLeftColor: "var(--error-red)"
            }}
          >
            <div className="font-medium mb-1">⚠️ Immediate attention required</div>
            <div className="text-xs text-muted-foreground">
              Line is below the 80% achievement threshold. Review production rate
              and check for equipment or staffing issues.
            </div>
          </div>

          <div className="text-xs text-muted-foreground p-2 bg-accent rounded flex items-center justify-between">
            <span>Detected at {current.detectedAt.toLocaleTimeString()}</span>
            <span>Auto-monitored every 10s</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg text-white font-medium transition-all hover:opacity-90 shadow-lg"
            style={{ background: "var(--gradient-warm)" }}
          >
            {hasMultiple
              ? `Acknowledge All (${alerts.length}) & Dismiss`
              : "Acknowledge & Dismiss"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ire to real backend data
// Polls /api/live every 10 seconds and fires an alert
// whenever any line is below the 80% achieve threshold.
// Fires on any page the user is currently viewing.
//

export function useAnomalyDetection() {
  const [alerts, setAlerts] = useState<AlertData[]>([]);

  // Track which lines have already been alerted this session
  // so we don't fire the same alert repeatedly
  const [alertedLines, setAlertedLines] = useState<Set<string>>(new Set());

  const checkForAnomalies = useCallback(async () => {
    try {
      const snapshot = await fetchLive();

      // Find lines below threshold that haven't been alerted yet
      const newAlerts: AlertData[] = snapshot.alerts
        .filter(a => !alertedLines.has(a.line))
        .map(a => ({
          line:        a.line,
          product:     a.product,
          achieve:     a.achieve,
          reason:      `Line ${a.line} achieve % is ${a.achieve.toFixed(1)}% — below the 80% production threshold.`,
          detectedAt:  new Date()
        }));

      if (newAlerts.length > 0) {
        // Mark these lines as alerted
        setAlertedLines(prev => {
          const next = new Set(prev);
          newAlerts.forEach(a => next.add(a.line));
          return next;
        });
        // Fire the alert overlay
        setAlerts(newAlerts);
      }
    } catch {
      // Backend not reachable — silently skip
    }
  }, [alertedLines]);

  useEffect(() => {
    // Check immediately on mount
    checkForAnomalies();

    // Then check every 10 seconds
    const interval = setInterval(checkForAnomalies, 10000);
    return () => clearInterval(interval);
  }, [checkForAnomalies]);

  const clearAlerts = useCallback(() => {
    setAlerts([]);
  }, []);

  // Reset alerted lines at midnight so fresh alerts fire next day
  useEffect(() => {
    const now        = new Date();
    const midnight   = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const msToMidnight = midnight.getTime() - now.getTime();

    const timeout = setTimeout(() => {
      setAlertedLines(new Set());
    }, msToMidnight);

    return () => clearTimeout(timeout);
  }, []);

  return { alerts, clearAlerts };
}