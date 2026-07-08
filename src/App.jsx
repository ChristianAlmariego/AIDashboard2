import { useState, useMemo } from "react";
import { useAdoData } from "./hooks/useAdoData";
import { groupByAssignee, groupByIteration, shortIteration } from "./utils/grouping";
import LoginPanel from "./components/LoginPanel";
import StatBar from "./components/StatBar";
import Toolbar from "./components/Toolbar";
import GroupSection from "./components/GroupSection";
import "./App.css";

export default function App() {
  const [pat, setPat] = useState("");
  const [connected, setConnected] = useState(false);
  const [view, setView] = useState("assignee");
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("All");

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

  const filtered = useMemo(() => {
    let result = stories;
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
  }, [stories, stateFilter, search]);

  const groups = useMemo(() => {
    if (view === "assignee") return groupByAssignee(filtered);
    return groupByIteration(filtered).map(([k, v]) => [shortIteration(k), v]);
  }, [filtered, view]);

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
          view={view}
          onViewChange={setView}
          search={search}
          onSearchChange={setSearch}
          stateFilter={stateFilter}
          onStateFilterChange={setStateFilter}
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
          <>
            <StatBar stories={filtered} />
            <div className="groups-container">
              {groups.length === 0 ? (
                <div className="empty-state">No stories match your filters.</div>
              ) : (
                groups.map(([label, items]) => (
                  <GroupSection key={label} label={label} stories={items} />
                ))
              )}
            </div>
          </>
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
