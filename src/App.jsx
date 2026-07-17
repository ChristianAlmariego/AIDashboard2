import { useState, useMemo } from "react";
import { useAdoData } from "./hooks/useAdoData";
import { shortIteration } from "./utils/grouping";
import LoginPanel from "./components/LoginPanel";
import AssigneeCard from "./components/AssigneeCard";
import BugsTab from "./components/BugsTab";
import "./App.css";

const LEGEND = [
  { color: "#f0c940", label: "In Progress Dev" },
  { color: "#17a2b8", label: "QA Test" },
  { color: "#e74c3c", label: "QA Test Failed / Blocked" },
  { color: "#9b59b6", label: "Waiting for Stage Deploy" },
  { color: "#adb5bd", label: "New" },
  { color: "#2ecc71", label: "Complete/Done (tasks)" },
];

const STATUS_ORDER = [
  "QA Test Failed",
  "Blocked",
  "In Progress Dev",
  "Waiting for Stage Deploy",
  "QA Test",
  "New",
];

const STATUS_COLORS = {
  "In Progress Dev":          { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" },
  "QA Test":                  { bg: "#d1ecf1", border: "#17a2b8", text: "#0c5460" },
  "QA Test Failed":           { bg: "#f8d7da", border: "#dc3545", text: "#721c24" },
  "Waiting for Stage Deploy": { bg: "#ede0f7", border: "#9b59b6", text: "#5e2a8a" },
  "Blocked":                  { bg: "#f8d7da", border: "#dc3545", text: "#721c24" },
  "New":                      { bg: "#e9ecef", border: "#adb5bd", text: "#495057" },
};

export default function App() {
  const [pat, setPat] = useState("");
  const [connected, setConnected] = useState(false);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");
  const [iterationFilter, setIterationFilter] = useState("All");
  const [tab, setTab] = useState("dashboard");
  const [featureRelatedOnly, setFeatureRelatedOnly] = useState(false);

  const { stories, loading, error, lastRefresh, load } = useAdoData();

  function handleConnect(token) { setPat(token); setConnected(true); load(token); }
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

  const summaryFiltered = useMemo(() => {
    if (!featureRelatedOnly) return filtered;
    return filtered.filter((s) => /^QA\s*:\s*/i.test(s.title));
  }, [filtered, featureRelatedOnly]);

  const statusGroups = useMemo(() => {
    const map = new Map();
    for (const story of summaryFiltered) {
      const key = story.state || "Unknown";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(story);
    }
    const sorted = [...map.entries()].sort(([a], [b]) => {
      const ai = STATUS_ORDER.indexOf(a);
      const bi = STATUS_ORDER.indexOf(b);
      const av = ai === -1 ? 999 : ai;
      const bv = bi === -1 ? 999 : bi;
      return av - bv;
    });
    return sorted;
  }, [summaryFiltered]);

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
            <select className="dash-select" value={iterationFilter} onChange={(e) => setIterationFilter(e.target.value)}>
              <option value="All">All Iterations</option>
              {iterations.map((it) => <option key={it} value={it}>{it}</option>)}
            </select>
            <select className="dash-select" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}>
              {["All","New","Active","Resolved","Closed"].map((s) => (
                <option key={s} value={s}>{s === "All" ? "All States" : s}</option>
              ))}
            </select>
            <input
              className="dash-search" type="search" placeholder="Search…"
              value={search} onChange={(e) => setSearch(e.target.value)}
            />
            <button className="dash-btn" onClick={handleRefresh} disabled={loading}>
              {loading ? "Loading…" : "↻ Refresh"}
            </button>
            <button className="dash-btn dash-btn-danger" onClick={handleDisconnect}>Disconnect</button>
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

      <div className="tab-bar">
        <button className={`tab-btn${tab === "dashboard" ? " active" : ""}`} onClick={() => setTab("dashboard")}>
          📋 Dashboard
        </button>
        <button className={`tab-btn${tab === "summary" ? " active" : ""}`} onClick={() => setTab("summary")}>
          📊 Summary by Status
        </button>
        <button className={`tab-btn${tab === "bugs" ? " active" : ""}`} onClick={() => setTab("bugs")}>
          🐛 Bugs by Feature
        </button>
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
            <button className="dash-btn" onClick={handleRefresh} style={{ marginTop: 12 }}>Retry</button>
          </div>
        )}
        {!loading && !error && stories.length === 0 && (
          <div className="empty-state">No user stories found under the configured area path.</div>
        )}

        {!loading && !error && stories.length > 0 && tab === "dashboard" && (
          assigneeGroups.length === 0
            ? <div className="empty-state">No stories match your filters.</div>
            : <div className="dash-grid">
                {assigneeGroups.map(([name, items]) => (
                  <AssigneeCard key={name} name={name} stories={items} todayStr={todayStr} />
                ))}
              </div>
        )}

        {!loading && !error && stories.length > 0 && tab === "summary" && (
          <div className="summary-view">
            <div className="sum-toolbar">
              <label className="sum-toggle-label">
                <input
                  type="checkbox"
                  className="sum-toggle-input"
                  checked={featureRelatedOnly}
                  onChange={(e) => setFeatureRelatedOnly(e.target.checked)}
                />
                <span className="sum-toggle-track">
                  <span className="sum-toggle-thumb" />
                </span>
                Feature Related
              </label>
              {featureRelatedOnly && (
                <span className="sum-toggle-hint">Showing stories with title starting with "QA: "</span>
              )}
            </div>
            <div className="summary-totals">
              <div className="sum-total-tile">
                <div className="sum-total-num">{summaryFiltered.length}</div>
                <div className="sum-total-lbl">Total Stories</div>
              </div>
              {statusGroups.map(([status, items]) => {
                const col = STATUS_COLORS[status] || { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
                const pct = summaryFiltered.length > 0
                  ? Math.round((items.length / summaryFiltered.length) * 100)
                  : 0;
                return (
                  <div key={status} className="sum-total-tile" style={{ borderTopColor: col.border }}>
                    <div className="sum-total-num" style={{ color: col.text }}>{items.length}</div>
                    <div className="sum-total-pct" style={{ color: col.text }}>{pct}%</div>
                    <div className="sum-total-lbl">{status}</div>
                  </div>
                );
              })}
            </div>

            <div className="sum-table-wrap">
              <table className="sum-table">
                <colgroup>
                  <col style={{ width: "100px" }} />
                  <col />
                  <col style={{ width: "220px" }} />
                  <col style={{ width: "90px" }} />
                  <col style={{ width: "50px" }} />
                  <col style={{ width: "70px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Title</th>
                    <th>Assignee</th>
                    <th>Sprint</th>
                    <th>Pts</th>
                    <th>Priority</th>
                  </tr>
                </thead>
                <tbody>
                  {statusGroups.map(([status, items]) => {
                    const col = STATUS_COLORS[status] || { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
                    return [
                      <tr key={`hdr-${status}`} className="sum-group-row">
                        <td colSpan={6}>
                          <span className="sum-group-label" style={{ color: col.text, borderLeftColor: col.border, background: col.bg }}>
                            {status}
                          </span>
                          <span className="sum-group-count">{items.length} {items.length === 1 ? "story" : "stories"}</span>
                        </td>
                      </tr>,
                      ...items.map((story) => (
                        <tr key={story.id} className="sum-story-row">
                          <td>
                            <a href={story.url} target="_blank" rel="noreferrer" className="sum-id-link">#{story.id}</a>
                          </td>
                          <td>
                            <a href={story.url} target="_blank" rel="noreferrer" className="sum-title-link">{story.title}</a>
                          </td>
                          <td>{story.assignee}</td>
                          <td>{shortIteration(story.iterationPath)}</td>
                          <td>{story.storyPoints ?? "—"}</td>
                          <td>{story.priority ? `P${story.priority}` : "—"}</td>
                        </tr>
                      )),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === "bugs" && <BugsTab pat={pat} />}
      </main>

      <footer className="dash-footer">
        <span>QA Team Dashboard · EMR-DigMod · {iterationFilter !== "All" ? iterationFilter : "All Iterations"}</span>
        <span>Draft for human review — verify figures before sharing</span>
      </footer>
    </div>
  );
}
