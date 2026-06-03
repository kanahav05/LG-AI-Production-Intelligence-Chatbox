import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import {
  MessageSquare,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Wrench,
  ArrowRight,
} from "lucide-react";
import { fetchLive, connectLiveStream, LiveSnapshot } from "../../api";

const productFilters = ["All", "REF", "WMC", "COMP", "RAC", "A08"];

export function MainDashboard() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");
  const [liveData, setLiveData] = useState<LiveSnapshot | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial fetch
    fetchLive()
      .then(data => { setLiveData(data); setLoading(false); })
      .catch(() => setLoading(false));

    // WebSocket for live updates
    const stop = connectLiveStream({
      onSnapshot: (data) => setLiveData(data)
    });

    return () => stop();
  }, []);

  const filteredRows = liveData?.rows.filter(row =>
    selectedFilter === "All" || row.product === selectedFilter
  ) ?? [];

  const getAchieveColor = (achieve: number) => {
    if (achieve >= 90) return "var(--success-green)";
    if (achieve >= 80) return "var(--warning-yellow)";
    return "var(--error-red)";
  };

  /* ── KPI data ── */
  const totalPlan = liveData?.summary.plan ?? 0;
  const totalResult = liveData?.summary.result ?? 0;
  const avgAchieve = liveData?.summary.achieve ?? 0;
  const alertCount = liveData?.alerts.length ?? 0;

  const kpis = [
    {
      label: "Total Plan",
      value: totalPlan.toLocaleString(),
      sub: "units today",
      icon: TrendingUp,
      color: "var(--lg-red)",
      bg: "rgba(165, 0, 52, 0.08)",
    },
    {
      label: "Total Result",
      value: totalResult.toLocaleString(),
      sub: "units so far",
      icon: TrendingUp,
      color: "var(--success-green)",
      bg: "rgba(22, 163, 74, 0.08)",
    },
    {
      label: "Avg Achievement",
      value: `${avgAchieve.toFixed(1)}%`,
      sub: avgAchieve >= 90 ? "on track" : avgAchieve >= 80 ? "needs attention" : "below target",
      icon: CheckCircle2,
      color: getAchieveColor(avgAchieve),
      bg:
        avgAchieve >= 90
          ? "rgba(22, 163, 74, 0.08)"
          : avgAchieve >= 80
          ? "rgba(217, 119, 6, 0.08)"
          : "rgba(220, 38, 38, 0.08)",
    },
    {
      label: "Active Alerts",
      value: alertCount.toString(),
      sub: alertCount === 0 ? "all clear" : `line${alertCount > 1 ? "s" : ""} below threshold`,
      icon: AlertTriangle,
      color: "var(--error-red)",
      bg: "rgba(220, 38, 38, 0.08)",
    },
  ];

  /* ── Quick‑action cards ── */
  const actions = [
    {
      title: "AI Production Assistant",
      desc: "Ask questions, get insights, and analyze production data using natural language.",
      icon: MessageSquare,
      onClick: () => navigate("/chatbox"),
      cta: "Open Chatbox",
    },
    {
      title: "Live Production Dashboard",
      desc: "Monitor every line in real time with predictions and alerts.",
      icon: Activity,
      onClick: () => navigate("/live-dashboard"),
      cta: "View Dashboard",
    },
    {
      title: "Equipment Diagnostics",
      desc: "Troubleshoot issues with AI-powered diagnostics and maintenance guides.",
      icon: Wrench,
      onClick: () => navigate("/chatbox"),
      cta: "Run Diagnostics",
    },
  ];

  return (
    <div className="min-h-screen dashboard-shell">
      <Header />

      <div className="max-w-[1440px] mx-auto px-6 py-8 space-y-8">

        {/* ═══ KPI Summary Row ═══ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {kpis.map((kpi, i) => (
            <div
              key={kpi.label}
              className="card-premium p-6 flex items-start gap-4"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              {/* icon circle */}
              <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{
                background: kpi.bg,
                boxShadow: "var(--shadow-xs)"
                }}
                >
                <kpi.icon className="w-6 h-6" style={{ color: kpi.color }} />
              </div>

              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide"
                  style={{ color: "var(--muted-foreground)" }}>
                  {kpi.label}
                </p>
                <p className="text-3xl font-bold tracking-tight"
                  style={{ color: "var(--foreground)", animationDelay: `${i * 80 + 200}ms` }}>
                  {loading ? "—" : kpi.value}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                  {kpi.sub}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* ═══ Quick Action Cards ═══ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {actions.map((a, i) => (
            <div
              key={a.title}
              className="card-premium p-6 flex flex-col justify-between min-h-[250px]"
            >
              <div>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center"
                    style={{
                      background: "rgba(165, 0, 52, 0.08)",
                    }}
                  >
                    <a.icon
                      className="w-5 h-5"
                      style={{ color: "var(--lg-red)" }}
                    />
                  </div>
                  <h3
                    className="text-lg font-bold"
                    style={{ color: "var(--foreground)" }}
                  >
                    {a.title}
                  </h3>
                </div>
                <p
                  className="text-sm leading-relaxed mb-5"
                  style={{
                    color: "var(--muted-foreground)",
                  }}
                >
                  {a.desc}
                </p>
              </div>

              <button
                onClick={a.onClick}
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  border: "2px solid var(--lg-red)",
                  color: "var(--lg-red)",
                   background: "transparent",
                  }}
              >
                {a.cta}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        {/* ═══ Live Line Performance Grid ═══ */}
        <div
          className="card-premium p-8"
          style={{ animationDelay: "640ms" }}
        >
          {/* header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-6 h-6" style={{ color: "var(--lg-red)" }} />
              <h2 className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
                Live Line Performance
              </h2>
            </div>
            <span
              className="px-3 py-1 rounded-full text-xs font-medium text-white animate-pulse"
              style={{ background: "#A50034" }}
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
                style={selectedFilter === filter ? { background: "#A50034" } : {}}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Line rows */}
          {loading ? (
            <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
              <Activity className="w-8 h-8 mx-auto mb-3 animate-pulse" style={{ color: "var(--lg-red)" }} />
              <p className="font-medium">Connecting to live data…</p>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="text-center py-12" style={{ color: "var(--muted-foreground)" }}>
              <p className="font-medium">No lines match the selected filter.</p>
            </div>
          ) : (
            <div className="space-y-4 mb-6">
              {filteredRows.map((row, idx) => (
                <div
                  key={row.line}
                  className="animate-fadeInUp space-y-2"
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium" style={{ color: "var(--foreground)" }}>
                        {row.line}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-semibold"
                        style={{ background: "var(--accent)", color: "var(--lg-red)" }}
                      >
                        {row.product}
                      </span>
                    </div>
                    <span className="font-bold text-sm" style={{ color: getAchieveColor(row.achieve) }}>
                      {row.achieve.toFixed(1)}%
                    </span>
                  </div>

                  <div className="relative h-3 rounded-full overflow-hidden" style={{ background:  "var(--background-soft)"}}>
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700"
                      style={{
                        width: `${Math.min(row.achieve, 100)}%`,
                        background: getAchieveColor(row.achieve),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Summary row */}
          {liveData && (
            <div
              className="flex items-center justify-between text-xs px-1 mb-4"
              style={{ color: "var(--muted-foreground)" }}
            >
              <span>
                Showing {filteredRows.length} of {liveData.rows.length} lines
              </span>
              <span>
                Factory avg: {liveData.summary.achieve.toFixed(1)}%
                {liveData.alerts.length > 0
                  ? ` · ⚠ ${liveData.alerts.length} alert${liveData.alerts.length > 1 ? "s" : ""}`
                  : " · ✓ All lines on track"}
              </span>
            </div>
          )}

          <button
            onClick={() => navigate("/live-dashboard")}
            className="btn-secondary w-full py-3 flex items-center justify-center gap-2">
            Show Full Dashboard
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}