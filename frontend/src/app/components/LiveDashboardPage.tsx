import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import {
  Download,
  FileText,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import {
  fetchLive,
  fetchPredictions,
  connectLiveStream,
  LiveSnapshot,
  Prediction,
} from "../../api";

const productFilters = ["All", "REF", "WMC", "COMP", "RAC", "A08"];

// ── Helpers ───────────────────────────────────────────────────
function getAchieveColor(achieve: number) {
  if (achieve >= 90) return "var(--success-green)";
  if (achieve >= 80) return "var(--warning-yellow)";
  return "var(--error-red)";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function LiveDashboardPage() {
  const navigate = useNavigate();

  // ── State ──────────────────────────────────────────────────
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [liveData,       setLiveData]        = useState<LiveSnapshot | null>(null);
  const [predictions,    setPredictions]     = useState<Prediction[]>([]);
  const [loading,        setLoading]         = useState(true);
  const [lastUpdated,    setLastUpdated]     = useState<Date>(new Date());

  // ── Initial data fetch ────────────────────────────────────
  useEffect(() => {
    Promise.all([fetchLive(), fetchPredictions()])
      .then(([live, preds]) => {
        setLiveData(live);
        setPredictions(preds.predictions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // ── WebSocket for per-second live updates ─────────────────
  useEffect(() => {
    const stop = connectLiveStream({
      onSnapshot: (data) => {
        setLiveData(data);
        setLastUpdated(new Date());
      },
    });
    return () => stop();
  }, []);

  // ── Refresh predictions every 60 seconds ──────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPredictions()
        .then(preds => setPredictions(preds.predictions))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Manual refresh ─────────────────────────────────────────
  const handleRefresh = useCallback(() => {
    fetchPredictions()
      .then(preds => setPredictions(preds.predictions))
      .catch(() => {});
  }, []);

  // ── Filtered rows ──────────────────────────────────────────
  const filteredRows = (liveData?.rows ?? []).filter(
    row => selectedFilter === "All" || row.product === selectedFilter
  );

  // ── KPI values from live data ──────────────────────────────
  const totalPlan    = liveData?.summary.plan    ?? 0;
  const totalResult  = liveData?.summary.result  ?? 0;
  const avgAchieve   = liveData?.summary.achieve ?? 0;
  const linesBelow80 = liveData?.alerts.length   ?? 0;

  // ── Prediction lookup by line ──────────────────────────────
  const predMap = Object.fromEntries(
    predictions.map(p => [p.line, p])
  );

  // ── Export CSV ─────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!liveData) return;
    const headers = "Date,Time,Line,Product,Phase,Plan,Target,Result,Achieve%,Status";
    const rows = liveData.rows.map(r =>
      `${r.date},${r.time},${r.line},${r.product},${r.phase},${r.plan},${r.target},${r.result},${r.achieve.toFixed(1)},${r.below_threshold ? "Below Threshold" : "On Track"}`
    );
 const summaryRow = `${liveData.summary.date},${liveData.summary.time},TOTAL,ALL,,${liveData.summary.plan},${liveData.summary.target},${liveData.summary.result},${liveData.summary.achieve.toFixed(1)},`;    const csv = [headers, ...rows, summaryRow].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `LG_Production_${liveData.date}_${liveData.time.replace(/:/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Export shift summary as text ───────────────────────────
  const handleShiftSummary = () => {
    if (!liveData) return;
    const lines = [
      `LG ELECTRONICS — PRODUCTION SHIFT SUMMARY`,
      `Date : ${liveData.date}`,
      `Time : ${liveData.time}`,
      ``,
      `FACTORY TOTALS`,
      `  Total Plan   : ${liveData.summary.plan.toLocaleString()} units`,
      `  Total Result : ${liveData.summary.result.toLocaleString()} units`,
      `  Avg Achieve  : ${liveData.summary.achieve.toFixed(1)}%`,
      `  Alerts       : ${liveData.alerts.length} line(s) below threshold`,
      ``,
      `LINE BREAKDOWN`,
      ...liveData.rows.map(r =>
        `  ${r.line.padEnd(8)} | ${r.product.padEnd(5)} | Plan: ${String(r.plan).padStart(5)} | Result: ${String(r.result).padStart(5)} | Achieve: ${r.achieve.toFixed(1).padStart(6)}% | ${r.below_threshold ? "BELOW THRESHOLD" : "On Track"}`
      ),
      ``,
      `Generated by LG AI Production Intelligence Chatbox`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `LG_ShiftSummary_${liveData.date}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header/>

      <div className="p-6 space-y-6">

        {/* Back button + last updated */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all hover:bg-accent"
            style={{ borderColor: "var(--lg-orange)", color: "var(--lg-orange)" }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Last updated: {formatTime(lastUpdated)}</span>
            <button
              onClick={handleRefresh}
              className="p-1 rounded hover:bg-accent transition-colors"
              title="Refresh predictions"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Plan</span>
              <TrendingUp className="w-5 h-5" style={{ color: "var(--lg-blue)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {loading ? "—" : totalPlan.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">units today</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Result</span>
              <TrendingUp className="w-5 h-5" style={{ color: "var(--success-green)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">
              {loading ? "—" : totalResult.toLocaleString()}
            </div>
            <div className="text-xs text-muted-foreground mt-1">units so far</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Achieve</span>
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--lg-orange)" }} />
            </div>
            <div
              className="text-3xl font-bold"
              style={{ color: getAchieveColor(avgAchieve) }}
            >
              {loading ? "—" : `${avgAchieve.toFixed(1)}%`}
            </div>
            <div className="text-xs text-muted-foreground mt-1">across all lines</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Below 80%</span>
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--error-red)" }} />
            </div>
            <div
              className="text-3xl font-bold"
              style={{ color: linesBelow80 > 0 ? "var(--error-red)" : "var(--success-green)" }}
            >
              {loading ? "—" : linesBelow80}
            </div>
            <div className="text-xs text-muted-foreground mt-1">lines need attention</div>
          </div>
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Live line grid */}
          <div className="lg:col-span-2 bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-foreground">Live Line Grid</h2>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium text-white animate-pulse"
                style={{ background: "var(--gradient-cool)" }}
              >
                LIVE
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {productFilters.map(filter => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFilter === filter
                      ? "text-white shadow-md"
                      : "bg-accent text-foreground hover:bg-muted"
                  }`}
                  style={selectedFilter === filter ? { background: "var(--gradient-warm)" } : {}}
                >
                  {filter}
                </button>
              ))}
            </div>

            {/* Line rows */}
            {loading ? (
              <div className="text-center text-muted-foreground py-12">
                Connecting to live data...
              </div>
            ) : (
              <div className="space-y-4">
                {filteredRows.map(row => {
                  const pred = predMap[row.line];
                  const willMeet = pred?.will_meet_plan ?? true;
                  return (
                    <div
                      key={row.line}
                      className="p-4 rounded-lg border border-border hover:border-primary transition-colors"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-foreground">{row.line}</span>
                          <span
                            className="px-3 py-1 rounded-full text-xs font-medium"
                            style={{ background: "var(--accent)", color: "var(--lg-orange)" }}
                          >
                            {row.product}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {row.phase}
                          </span>
                        </div>
                        <div className="text-right">
                          <div
                            className="text-2xl font-bold"
                            style={{ color: getAchieveColor(row.achieve) }}
                          >
                            {row.achieve.toFixed(1)}%
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.result.toLocaleString()} / {row.plan.toLocaleString()}
                          </div>
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="relative h-3 bg-accent rounded-full overflow-hidden mb-2">
                        <div
                          className="absolute top-0 left-0 h-full rounded-full transition-all duration-1000"
                          style={{
                            width: `${Math.min(row.achieve, 100)}%`,
                            background: getAchieveColor(row.achieve),
                          }}
                        />
                      </div>

                      {/* Prediction status */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {willMeet ? (
                            <>
                              <CheckCircle2 className="w-4 h-4" style={{ color: "var(--success-green)" }} />
                              <span className="text-xs font-medium" style={{ color: "var(--success-green)" }}>
                                On Track
                              </span>
                            </>
                          ) : (
                            <>
                              <TrendingDown className="w-4 h-4" style={{ color: "var(--error-red)" }} />
                              <span className="text-xs font-medium" style={{ color: "var(--error-red)" }}>
                                Will Miss Plan
                              </span>
                            </>
                          )}
                        </div>
                        {pred && (
                          <span className="text-xs text-muted-foreground">
                            Projected: {pred.projected_result.toLocaleString()} / {pred.plan.toLocaleString()} units
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right column */}
          <div className="space-y-6">

            {/* Active alerts */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5" style={{ color: "var(--error-red)" }} />
                <h2 className="text-lg font-bold text-foreground">Active Alerts</h2>
                {liveData && liveData.alerts.length > 0 && (
                  <span
                    className="ml-auto px-2 py-0.5 rounded-full text-xs font-bold text-white"
                    style={{ background: "var(--error-red)" }}
                  >
                    {liveData.alerts.length}
                  </span>
                )}
              </div>

              <div className="space-y-3">
                {loading ? (
                  <div className="text-sm text-muted-foreground">Loading alerts...</div>
                ) : liveData && liveData.alerts.length > 0 ? (
                  liveData.alerts.map((alert, i) => (
                    <div
                      key={i}
                      className="p-4 rounded-lg border-l-4"
                      style={{
                        borderLeftColor: "var(--error-red)",
                        background: "var(--accent)"
                      }}
                    >
                      <div className="font-medium text-foreground mb-1">{alert.line}</div>
                      <div className="text-sm text-muted-foreground">
                        Achieve: {alert.achieve}% — below 80% threshold
                      </div>
                      <div className="mt-2">
                        <span
                          className="px-2 py-1 rounded text-xs font-medium text-white"
                          style={{ background: "var(--error-red)" }}
                        >
                          BELOW THRESHOLD
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex items-center gap-2 text-sm"
                    style={{ color: "var(--success-green)" }}>
                    <CheckCircle2 className="w-4 h-4" />
                    All lines above threshold
                  </div>
                )}
              </div>
            </div>

            {/* Predictive summary */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-5 h-5" style={{ color: "var(--lg-blue)" }} />
                <h2 className="text-lg font-bold text-foreground">Predictions</h2>
              </div>
              {predictions.length === 0 ? (
                <div className="text-sm text-muted-foreground">Loading predictions...</div>
              ) : (
                <div className="space-y-2">
                  {predictions.map(pred => (
                    <div key={pred.line} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {pred.will_meet_plan
                          ? <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: "var(--success-green)" }} />
                          : <TrendingDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--error-red)" }} />
                        }
                        <span className="font-medium">{pred.line}</span>
                      </div>
                      <span
                        className="text-xs font-medium"
                        style={{ color: pred.will_meet_plan ? "var(--success-green)" : "var(--error-red)" }}
                      >
                        {pred.will_meet_plan ? "On Track" : "At Risk"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Exports */}
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <h2 className="text-lg font-bold text-foreground mb-4">Exports & Reports</h2>
              <div className="space-y-3">
                <button
                  onClick={handleExportCSV}
                  className="w-full py-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-center gap-2 font-medium"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button
                  className="w-full py-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-center gap-2 font-medium"
                  onClick={() => alert("PDF export coming in Week 6")}
                >
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={handleShiftSummary}
                  className="w-full py-3 rounded-lg text-white transition-all hover:opacity-90 flex items-center justify-center gap-2 font-medium shadow-md"
                  style={{ background: "var(--gradient-warm)" }}
                >
                  <FileText className="w-4 h-4" />
                  Shift Summary
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}