import { useState, useMemo } from "react";
import { useAdoData } from "./hooks/useAdoData";
import { shortIteration } from "./utils/grouping";
import LoginPanel from "./components/LoginPanel";
import AssigneeCard from "./components/AssigneeCard";
import "./App.css";

const LEGEND = [
  { color: "#f0c940", label: "In Progress Dev" },
  { color: "#17a2b8", label: "QA Test" },
  { color: "#e74c3c", label: "QA Test Failed / Blocked" },
  { color: "#9b59b6", label: "Waiting for Stage Deploy" },
  { color: "#adb5bd", label: "New" },
  { color: "#2ecc71", label: "Complete/Done (tasks)" },
];

export default function App() {
  const [pat, setPat] = useState("");
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [iterationFilter, setIterationFilter] = useState("All");

  const { stories, loading, error, lastRefresh, load } = useAdoData();

  function handleConnect(token) {
    setPat(token);
    setConnected(true);
    load(token);
  }

  function handleRefresh() { if (pat) load(pat); }
  function handleDisconnect() { setPat(""); setConnected(false); }

  const iterations = useMemo(() => {
    const set = new Set(stories.map((s) => shortIteration(s.iterationPath)).filter(Boolean));
    return [...set].sort();
  }, [stories]);

  const filtered = useMemo(() => {
    let result = stories;
    if (iterationFilter !== "All")
      result = result.filter((s) => shortIteration(s.iterationPath) === iterationFilter);
    if (stateFilter !== "All")
      result = result.filter((s) => s.state === stateFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.assignee.toLowerCase().includes(q) ||
          String(s.id).includes(q) ||
          s.tags.toLowerCase().includes(q)
      );
    }
    return result;
  }, [stories, stateFilter, iterationFilter, search]);

  const assigneeGroups = useMemo(() => {
    const map = new Map();
    for (const story of filtered) {
      const key = story.assignee || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(story);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const todayStr = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });

  if (!connected) {
    return <LoginPanel onConnect={handleConnect} loading={loading} error={error} />;
  }

  return (
    <div className="app">
      <header className="dash-header">
        <div className="dash-header-left">
          <div className="dash-title">📋 QA Team Daily Dashboard — User Stories</div>
          <div className="dash-sub">Emerson Digital Modernization · {iterationFilter !== "All" ? iterationFilter : "All Iterations"}</div>
        </div>
        <div className="dash-header-right">
          <div className="dash-date">📅 {todayStr}</div>
          <div className="dash-controls">
            <select
              className="dash-select"
              value={iterationFilter}
              onChange={(e) => setIterationFilter(e.target.value)}
            >
              <option value="All">All Iterations</option>
              {iterations.map((it) => <option key={it} value={it}>{it}</option>)}
            </select>
            <select
              className="dash-select"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
            >
              {["All","New","Active","Resolved","Closed"].map((s) => (
                <option key={s} value={s}>{s === "All" ? "All States" : s}</option>
              ))}
            </select>
            <input
              className="dash-search"
              type="search"
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button className="dash-btn" onClick={handleRefresh} disabled={loading}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
            <button className="dash-btn dash-btn-danger" onClick={handleDisconnect}>
              Disconnect
            </button>
          </div>
        </div>
      </header>

      <div className="dash-legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
        {lastRefresh && (
          <span className="legend-item" style={{ marginLeft: "auto", color: "#aaa" }}>
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
      </div>

      <main className="dash-main">
        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Fetching user stories from Azure DevOps…</span>
          </div>
        )}

        {!loading && error && (
          <div className="error-state">
            <strong>Error connecting to ADO:</strong> {error}
            <button className="dash-btn" onClick={handleRefresh} style={{ marginTop: 12 }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="empty-state">No user stories found under the configured area path.</div>
        )}

        {!loading && !error && stories.length > 0 && (
          assigneeGroups.length === 0
            ? <div className="empty-state">No stories match your filters.</div>
            : <div className="dash-grid">
                {assigneeGroups.map(([name, items]) => (
                  <AssigneeCard key={name} name={name} stories={items} todayStr={todayStr} />
                ))}
              </div>
        )}
      </main>

      <footer className="dash-footer">
        <span>QA Team Dashboard · EMR-DigMod · {iterationFilter !== "All" ? iterationFilter : "All Iterations"}</span>
        <span>Draft for human review — verify figures before sharing</span>
      </footer>
    </div>
  );
}
