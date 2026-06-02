import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Header } from "./Header";
import { MessageSquare, TrendingUp } from "lucide-react";
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

  return (
    <div className="min-h-screen bg-background" style={{background: "#F5F3EF"}}>
      <Header/>

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Left — Chatbox description */}
          <div className="rounded-2xl p-8 border border-border bg-gradient-to-br from-card to-accent shadow-lg">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: "#A50034" }}>
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  AI Production Assistant
                </h2>
                <p className="text-muted-foreground">
                  Ask questions about production data, get insights on line
                  performance, predict outcomes, and analyze trends using
                  natural language, voice, or file upload.
                </p>
              </div>
            </div>
            <div className="space-y-3 mb-6">
              {[
                "Real-time production data analysis",
                "Natural language query support",
                "Predictive performance insights",
                "Multi-modal input: text, voice, and files"
              ].map(f => (
                <div key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 rounded-full" style={{ background: "#A50034" }} />
                  <span>{f}</span>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate("/chatbox")}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 shadow-lg"
              style={{ background: "linear-gradient(135deg,#A50034 0%,#C2185B 100%)" }}
            >
              Open Chatbox
            </button>
          </div>

          {/* Right — Live line grid */}
          <div className="rounded-2xl p-6 border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6" style={{ color: "var(--lg-orange)" }} />
                <h2 className="text-xl font-bold text-foreground">Live Line Performance</h2>
              </div>
              <span className="px-3 py-1 rounded-full text-xs font-medium text-white animate-pulse"
                style={{ background: "#A50034" }}>
                LIVE
              </span>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {productFilters.map(filter => (
                <button key={filter} onClick={() => setSelectedFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    selectedFilter === filter
                      ? "text-white shadow-md"
                      : "bg-accent text-foreground hover:bg-muted"
                  }`}
                  style={selectedFilter === filter ? { background: "#A50034" } : {}}>
                  {filter}
                </button>
              ))}
            </div>

            {/* Line rows */}
            {loading ? (
              <div className="text-center text-muted-foreground py-8">
                Connecting to live data...
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {filteredRows.slice(0, 6).map(row => (
                  <div key={row.line} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-medium text-foreground">{row.line}</span>
                        <span className="px-2 py-1 rounded text-xs font-medium"
                          style={{ background: "#FAF0F4", color: "#A50034" }}>
                          {row.product}
                        </span>
                      </div>
                      <span className="font-bold"
                        style={{ color: getAchieveColor(row.achieve) }}>
                        {row.achieve.toFixed(1)}%
                      </span>
                    </div>
                    <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                      <div className="absolute top-0 left-0 h-full rounded-full transition-all"
                        style={{
                          width: `${Math.min(row.achieve, 100)}%`,
                          background: getAchieveColor(row.achieve)
                        }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Summary row */}
            {liveData && (
              <div className="text-xs text-muted-foreground mb-4 text-right">
                Factory avg: {liveData.summary.achieve.toFixed(1)}% |
                {liveData.alerts.length > 0
                  ? ` ⚠ ${liveData.alerts.length} line(s) below threshold`
                  : " ✓ All lines on track"}
              </div>
            )}

            <button onClick={() => navigate("/live-dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent"
              style={{ borderColor: "#A50034", color: "#A50034" }}>
              Show More Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}