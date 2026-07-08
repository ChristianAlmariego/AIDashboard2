import { useState, useMemo } from "react";
import { useAdoData } from "./hooks/useAdoData";
import { shortIteration } from "./utils/grouping";
import LoginPanel from "./components/LoginPanel";
import Toolbar from "./components/Toolbar";
import AssigneeCard from "./components/AssigneeCard";
import "./App.css";

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

  function handleRefresh() {
    if (pat) load(pat);
  }

  function handleDisconnect() {
    setPat("");
    setConnected(false);
  }

  const iterations = useMemo(() => {
    const set = new Set(stories.map((s) => shortIteration(s.iterationPath)).filter(Boolean));
    return [...set].sort();
  }, [stories]);

  const filtered = useMemo(() => {
    let result = stories;
    if (iterationFilter !== "All") {
      result = result.filter((s) => shortIteration(s.iterationPath) === iterationFilter);
    }
    if (stateFilter !== "All") {
      result = result.filter((s) => s.state === stateFilter);
    }
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
      <header className="app-header">
        <div className="header-brand">
          <svg width="28" height="28" viewBox="0 0 40 40" fill="none">
            <rect width="40" height="40" rx="8" fill="#0078d4" />
            <path d="M8 28L16 12L24 22L30 16L34 28H8Z" fill="white" opacity="0.9" />
          </svg>
          <div className="header-titles">
            <span className="header-main">ADO Dashboard</span>
            <span className="header-sub">Emerson Quality Assurance Team · EMR-DigMod\EMR DCX IT</span>
          </div>
        </div>
      </header>

      <main className="app-main">
        <Toolbar
          search={search}
          onSearchChange={setSearch}
          stateFilter={stateFilter}
          onStateFilterChange={setStateFilter}
          iterationFilter={iterationFilter}
          onIterationFilterChange={setIterationFilter}
          iterations={iterations}
          lastRefresh={lastRefresh}
          onRefresh={handleRefresh}
          loading={loading}
          onDisconnect={handleDisconnect}
        />

        {loading && (
          <div className="loading-state">
            <div className="spinner" />
            <span>Fetching user stories from Azure DevOps…</span>
          </div>
        )}

        {!loading && error && (
          <div className="error-state">
            <strong>Error connecting to ADO:</strong> {error}
            <button className="btn-primary" onClick={handleRefresh} style={{ marginTop: 12 }}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && stories.length > 0 && (
          <div className="dash-grid">
            {assigneeGroups.length === 0 ? (
              <div className="empty-state">No stories match your filters.</div>
            ) : (
              assigneeGroups.map(([name, items]) => (
                <AssigneeCard key={name} name={name} stories={items} todayStr={todayStr} />
              ))
            )}
          </div>
        )}

        {!loading && !error && stories.length === 0 && (
          <div className="empty-state">
            No user stories found under the configured area path.
          </div>
        )}
      </main>
    </div>
  );
}
