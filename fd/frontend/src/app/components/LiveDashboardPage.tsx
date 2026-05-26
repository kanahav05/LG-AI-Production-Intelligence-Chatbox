import { useState } from "react";
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
} from "lucide-react";

const productFilters = ["All", "REF", "WMC", "COMP", "RAC", "A08"];

const mockLineData = [
  { line: "Line 1", product: "REF", achieve: 92, plan: 1000, result: 920, prediction: "on-track" },
  { line: "Line 2", product: "WMC", achieve: 88, plan: 800, result: 704, prediction: "on-track" },
  { line: "Line 3", product: "COMP", achieve: 95, plan: 1200, result: 1140, prediction: "on-track" },
  { line: "Line 4", product: "RAC", achieve: 76, plan: 900, result: 684, prediction: "will-miss" },
  { line: "Line 5", product: "A08", achieve: 91, plan: 1100, result: 1001, prediction: "on-track" },
  { line: "Line 6", product: "REF", achieve: 85, plan: 950, result: 807, prediction: "on-track" },
  { line: "Line 7", product: "WMC", achieve: 78, plan: 850, result: 663, prediction: "will-miss" },
  { line: "Line 8", product: "COMP", achieve: 93, plan: 1150, result: 1069, prediction: "on-track" },
];

const mockAlerts = [
  { id: 1, line: "Line 4", reason: "Production rate 18% below target", severity: "high" },
  { id: 2, line: "Line 7", reason: "Unexpected downtime detected", severity: "medium" },
];

export function LiveDashboardPage() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");

  const filteredLines = selectedFilter === "All"
    ? mockLineData
    : mockLineData.filter(line => line.product === selectedFilter);

  const totalPlan = mockLineData.reduce((sum, line) => sum + line.plan, 0);
  const totalResult = mockLineData.reduce((sum, line) => sum + line.result, 0);
  const avgAchieve = Math.round(
    mockLineData.reduce((sum, line) => sum + line.achieve, 0) / mockLineData.length
  );
  const linesBelow80 = mockLineData.filter(line => line.achieve < 80).length;

  const getAchieveColor = (achieve: number) => {
    if (achieve >= 90) return "var(--success-green)";
    if (achieve >= 80) return "var(--warning-yellow)";
    return "var(--error-red)";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Live Dashboard" showShift currentShift="Shift A - Morning" />

      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 font-medium transition-all hover:bg-accent"
            style={{
              borderColor: "var(--lg-orange)",
              color: "var(--lg-orange)"
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Plan</span>
              <TrendingUp className="w-5 h-5" style={{ color: "var(--lg-blue)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalPlan.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">units today</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Total Result</span>
              <TrendingUp className="w-5 h-5" style={{ color: "var(--success-green)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">{totalResult.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground mt-1">units so far</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Avg Achieve</span>
              <CheckCircle2 className="w-5 h-5" style={{ color: "var(--lg-orange)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">{avgAchieve}%</div>
            <div className="text-xs text-muted-foreground mt-1">across all lines</div>
          </div>

          <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-muted-foreground">Below 80%</span>
              <AlertTriangle className="w-5 h-5" style={{ color: "var(--error-red)" }} />
            </div>
            <div className="text-3xl font-bold text-foreground">{linesBelow80}</div>
            <div className="text-xs text-muted-foreground mt-1">lines need attention</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

            <div className="flex flex-wrap gap-2 mb-6">
              {productFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFilter === filter
                      ? "text-white shadow-md"
                      : "bg-accent text-foreground hover:bg-muted"
                  }`}
                  style={
                    selectedFilter === filter
                      ? { background: "var(--gradient-warm)" }
                      : {}
                  }
                >
                  {filter}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {filteredLines.map((line) => (
                <div
                  key={line.line}
                  className="p-4 rounded-lg border border-border hover:border-primary transition-colors"
                >
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-foreground">{line.line}</span>
                      <span
                        className="px-3 py-1 rounded-full text-xs font-medium"
                        style={{
                          background: "var(--accent)",
                          color: "var(--lg-orange)"
                        }}
                      >
                        {line.product}
                      </span>
                    </div>
                    <div className="text-right">
                      <div
                        className="text-2xl font-bold"
                        style={{ color: getAchieveColor(line.achieve) }}
                      >
                        {line.achieve}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {line.result} / {line.plan}
                      </div>
                    </div>
                  </div>

                  <div className="relative h-3 bg-accent rounded-full overflow-hidden mb-2">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full transition-all"
                      style={{
                        width: `${line.achieve}%`,
                        background: getAchieveColor(line.achieve),
                      }}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {line.prediction === "on-track" ? (
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
                            Will Miss Target
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5" style={{ color: "var(--error-red)" }} />
                <h2 className="text-lg font-bold text-foreground">Active Alerts</h2>
              </div>

              <div className="space-y-3">
                {mockAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="p-4 rounded-lg border-l-4"
                    style={{
                      borderLeftColor: alert.severity === "high" ? "var(--error-red)" : "var(--warning-yellow)",
                      background: "var(--accent)"
                    }}
                  >
                    <div className="font-medium text-foreground mb-1">{alert.line}</div>
                    <div className="text-sm text-muted-foreground">{alert.reason}</div>
                    <div className="mt-2">
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background: alert.severity === "high" ? "var(--error-red)" : "var(--warning-yellow)",
                          color: "white"
                        }}
                      >
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-card rounded-xl p-6 border border-border shadow-sm">
              <h2 className="text-lg font-bold text-foreground mb-4">Exports & Reports</h2>
              <div className="space-y-3">
                <button className="w-full py-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-center gap-2 font-medium">
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
                <button className="w-full py-3 rounded-lg border border-border hover:bg-accent transition-colors flex items-center justify-center gap-2 font-medium">
                  <Download className="w-4 h-4" />
                  Export PDF
                </button>
                <button
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
