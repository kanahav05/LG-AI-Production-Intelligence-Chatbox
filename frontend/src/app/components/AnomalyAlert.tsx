import { useEffect, useState, useCallback } from "react";
import { X, AlertTriangle, ChevronLeft, ChevronRight, FlaskConical } from "lucide-react";
import { fetchLive } from "../../api";
import { AlertData } from "../alertsContext";
import { playAlertSequence, speakAlertMessage } from "../soundAlert";

// Modal
interface AnomalyAlertProps {
  alerts: AlertData[];
  onClose: () => void;
}

export function AnomalyAlert({ alerts, onClose }: AnomalyAlertProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Speak the "immediate attention" message after the beep plays
  useEffect(() => {
    if (alerts.length === 0) return;

    const severity = alerts.length >= 3 ? 'critical' : 'warning';

    // Build a concise spoken message summarising all alerts
    const lineList = alerts.map(a => `Line ${a.line}, ${a.product}, at ${a.achieve.toFixed(0)} percent`).join('. ');
    const intro = alerts.length === 1
      ? `Anomaly detected. ${lineList}.`
      : `${alerts.length} anomalies detected. ${lineList}.`;

    const message = `${intro} Immediate attention required. Review production rate and check for equipment or staffing issues.`;

    speakAlertMessage(message, severity);

    // Cancel speech when modal is closed / alerts cleared
    return () => { window.speechSynthesis?.cancel(); };
  }, [alerts]);

  if (alerts.length === 0) return null;

  const current     = alerts[currentIndex];
  const hasMultiple = alerts.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
         style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)" }}>

      <div className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
           style={{ background: "#ffffff", border: "2px solid #DC2626" }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4"
             style={{ background: "#DC2626" }}>
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-white animate-pulse" />
            <div>
              <p className="text-white font-bold text-base leading-tight">Anomaly Detected!</p>
              <p className="text-red-100 text-xs mt-0.5">
                {alerts.length === 1
                  ? "Production threshold breach detected"
                  : `${alerts.length} lines below threshold`}
              </p>
            </div>
          </div>
          <button onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                  style={{ background: "rgba(255,255,255,0.2)" }}>
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Pagination*/}
        {hasMultiple && (
          <div className="flex items-center justify-between px-5 pt-4">
            <button onClick={() => setCurrentIndex(i => Math.max(0, i - 1))}
                    disabled={currentIndex === 0}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ background: "#FEE2E2" }}>
              <ChevronLeft className="w-4 h-4" style={{ color: "#DC2626" }} />
            </button>
            <span className="text-xs font-semibold" style={{ color: "#6B7280" }}>
              Alert {currentIndex + 1} of {alerts.length}
            </span>
            <button onClick={() => setCurrentIndex(i => Math.min(alerts.length - 1, i + 1))}
                    disabled={currentIndex === alerts.length - 1}
                    className="w-7 h-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30"
                    style={{ background: "#FEE2E2" }}>
              <ChevronRight className="w-4 h-4" style={{ color: "#DC2626" }} />
            </button>
          </div>
        )}

        {/* Body  */}
        <div className="px-5 pb-5 pt-4 space-y-4">

          {/* Line + Achievement */}
          <div className="flex items-center justify-between p-4 rounded-xl"
               style={{ background: "#FEF2F2", border: "1px solid #FECACA" }}>
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: "#9CA3AF" }}>Production Line</p>
              <p className="text-2xl font-bold" style={{ color: "#111827" }}>{current.line}</p>
              <p className="text-sm font-medium" style={{ color: "#6B7280" }}>{current.product}</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium mb-1" style={{ color: "#9CA3AF" }}>Achievement</p>
              <p className="text-3xl font-bold" style={{ color: "#DC2626" }}>
                {current.achieve.toFixed(1)}%
              </p>
              <p className="text-xs" style={{ color: "#9CA3AF" }}>threshold: 90%</p>
            </div>
          </div>

          {/* Issue reason */}
          <div className="px-4 py-3 rounded-xl" style={{ background: "#F9FAFB", border: "1px solid #E5E7EB" }}>
            <p className="text-xs font-semibold uppercase tracking-wide mb-1" style={{ color: "#9CA3AF" }}>
              Issue Detected
            </p>
            <p className="text-sm font-medium" style={{ color: "#374151" }}>{current.reason}</p>
          </div>

          {/* Warning box */}
          <div className="flex gap-3 px-4 py-3 rounded-xl"
               style={{ background: "#FFF7ED", border: "1px solid #FED7AA", borderLeft: "4px solid #F97316" }}>
            <span className="text-lg leading-none mt-0.5">⚠️</span>
            <div>
              <p className="text-sm font-bold mb-0.5" style={{ color: "#9A3412" }}>
                Immediate attention required
              </p>
              <p className="text-xs" style={{ color: "#C2410C" }}>
                Line is below the 90% achievement threshold. Review production
                rate and check for equipment or staffing issues.
              </p>
            </div>
          </div>

          {/* Timestamp row */}
          <div className="flex items-center justify-between px-1">
            <p className="text-xs" style={{ color: "#9CA3AF" }}>
              Detected at {current.detectedAt.toLocaleTimeString()}
            </p>
            <p className="text-xs" style={{ color: "#9CA3AF" }}>Auto-monitored every 10s</p>
          </div>

          {/* Acknowledge button */}
          <button
            onClick={onClose}
            className="w-full py-3 rounded-xl text-white text-sm font-bold transition-opacity hover:opacity-90 shadow-md"
            style={{ background: "#DC2626" }}
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

// Dev-only test trigger 
interface TestAlertTriggerProps {
  setAlerts: (alerts: AlertData[]) => void;
}

export function TestAlertTrigger({ setAlerts }: TestAlertTriggerProps) {
  const fireTest = () => {
    const mockAlerts: AlertData[] = [
      {
        line:       "R1",
        product:    "REF",
        achieve:    74.3,
        reason:     "[TEST] Line R1 achieve % is 74.3% — below the 90% production threshold.",
        detectedAt: new Date(),
      },
      {
        line:       "CM1",
        product:    "COMP",
        achieve:    61.8,
        reason:     "[TEST] Line CM1 achieve % is 61.8% — below the 90% production threshold.",
        detectedAt: new Date(),
      },
    ];
    setAlerts(mockAlerts);
    playAlertSequence(mockAlerts.length);
  };

  return (
    <button
      onClick={fireTest}
      title="Test anomaly alert (dev only)"
      className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold shadow-lg transition-all hover:opacity-90"
      style={{ background: "#7C3AED" }}
    >
      <FlaskConical className="w-4 h-4" />
      Test Alert
    </button>
  );
}

// Polling hook
export function useAnomalyDetection() {
  const [alerts,       setAlerts]       = useState<AlertData[]>([]);
  const [alertedLines, setAlertedLines] = useState<Set<string>>(new Set());

  const checkForAnomalies = useCallback(async () => {
    try {
      const snapshot = await fetchLive();

      const newAlerts: AlertData[] = snapshot.alerts
        .filter(a => a.achieve < 90 && !alertedLines.has(a.line))
        .map(a => ({
          line:       a.line,
          product:    a.product,
          achieve:    a.achieve,
          reason:     `Line ${a.line} achieve % is ${a.achieve.toFixed(1)}% — below the 90% production threshold.`,
          detectedAt: new Date(),
        }));

      if (newAlerts.length > 0) {
        setAlertedLines(prev => {
          const next = new Set(prev);
          newAlerts.forEach(a => next.add(a.line));
          return next;
        });
        setAlerts(newAlerts);
        playAlertSequence(newAlerts.length);
      }
    } catch {
      // Backend unreachable or outside production hours — skip silently
    }
  }, [alertedLines]);

  useEffect(() => {
    checkForAnomalies();
    const interval = setInterval(checkForAnomalies, 10000);
    return () => clearInterval(interval);
  }, [checkForAnomalies]);

  const clearAlerts = useCallback(() => setAlerts([]), []);

  // Reset alerted-lines at midnight so lines can re-alert the next day
  useEffect(() => {
    const now      = new Date();
    const midnight = new Date(now);
    midnight.setHours(24, 0, 0, 0);
    const timeout  = setTimeout(() => setAlertedLines(new Set()), midnight.getTime() - now.getTime());
    return () => clearTimeout(timeout);
  }, []);

  return { alerts, setAlerts, clearAlerts };
}