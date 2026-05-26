import { useNavigate } from "react-router";
import { Header } from "./Header";
import { MessageSquare, TrendingUp, Filter } from "lucide-react";
import { useState } from "react";

const productFilters = ["All", "REF", "WMC", "COMP", "RAC", "A08"];

const mockLineData = [
  { line: "Line 1", product: "REF", achieve: 92, plan: 1000, result: 920 },
  { line: "Line 2", product: "WMC", achieve: 88, plan: 800, result: 704 },
  { line: "Line 3", product: "COMP", achieve: 95, plan: 1200, result: 1140 },
  { line: "Line 4", product: "RAC", achieve: 76, plan: 900, result: 684 },
  { line: "Line 5", product: "A08", achieve: 91, plan: 1100, result: 1001 },
  { line: "Line 6", product: "REF", achieve: 85, plan: 950, result: 807 },
];

export function MainDashboard() {
  const navigate = useNavigate();
  const [selectedFilter, setSelectedFilter] = useState("All");

  const filteredLines = selectedFilter === "All"
    ? mockLineData
    : mockLineData.filter(line => line.product === selectedFilter);

  const getAchieveColor = (achieve: number) => {
    if (achieve >= 90) return "var(--success-green)";
    if (achieve >= 80) return "var(--warning-yellow)";
    return "var(--error-red)";
  };

  return (
    <div className="min-h-screen bg-background">
      <Header title="Production Intelligence" showShift currentShift="Shift A" />

      <div className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div
            className="rounded-2xl p-8 border border-border bg-gradient-to-br from-card to-accent shadow-lg"
          >
            <div className="flex items-start gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center shadow-md"
                style={{ background: "var(--gradient-warm)" }}
              >
                <MessageSquare className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  AI Production Assistant
                </h2>
                <p className="text-muted-foreground">
                  Ask questions about production data, get insights on line performance,
                  predict outcomes, and analyze trends. Get intelligent answers and
                  recommendations to optimize your factory operations.
                </p>
              </div>
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--lg-orange)" }} />
                <span>Real-time production data analysis</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--lg-orange)" }} />
                <span>Natural language query support</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--lg-orange)" }} />
                <span>Predictive performance insights</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full" style={{ background: "var(--lg-orange)" }} />
                <span>Multi-modal input: text, voice, and files</span>
              </div>
            </div>

            <button
              onClick={() => navigate("/chatbox")}
              className="w-full py-3 rounded-xl text-white font-medium transition-all hover:opacity-90 shadow-lg"
              style={{ background: "var(--gradient-warm)" }}
            >
              Open Chatbox
            </button>
          </div>

          <div className="rounded-2xl p-6 border border-border bg-card shadow-lg">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <TrendingUp className="w-6 h-6" style={{ color: "var(--lg-orange)" }} />
                <h2 className="text-xl font-bold text-foreground">Live Line Performance</h2>
              </div>
              <span
                className="px-3 py-1 rounded-full text-xs font-medium text-white"
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

            <div className="space-y-4 mb-6">
              {filteredLines.slice(0, 6).map((line) => (
                <div key={line.line} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-foreground">{line.line}</span>
                      <span
                        className="px-2 py-1 rounded text-xs font-medium"
                        style={{
                          background: "var(--accent)",
                          color: "var(--lg-orange)"
                        }}
                      >
                        {line.product}
                      </span>
                    </div>
                    <span
                      className="font-bold"
                      style={{ color: getAchieveColor(line.achieve) }}
                    >
                      {line.achieve}%
                    </span>
                  </div>
                  <div className="relative h-2 bg-accent rounded-full overflow-hidden">
                    <div
                      className="absolute top-0 left-0 h-full rounded-full transition-all"
                      style={{
                        width: `${line.achieve}%`,
                        background: getAchieveColor(line.achieve),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              onClick={() => navigate("/live-dashboard")}
              className="w-full py-3 rounded-xl border-2 font-medium transition-all hover:bg-accent"
              style={{
                borderColor: "var(--lg-orange)",
                color: "var(--lg-orange)"
              }}
            >
              Show More Details
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
