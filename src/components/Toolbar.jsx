export default function Toolbar({
  search,
  onSearchChange,
  stateFilter,
  onStateFilterChange,
  iterationFilter,
  onIterationFilterChange,
  iterations,
  lastRefresh,
  onRefresh,
  loading,
  onDisconnect,
}) {
  const states = ["All", "New", "Active", "Resolved", "Closed"];

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <input
          className="search-input"
          type="search"
          placeholder="Search stories…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />

        <select
          className="state-filter"
          value={stateFilter}
          onChange={(e) => onStateFilterChange(e.target.value)}
        >
          {states.map((s) => (
            <option key={s} value={s}>
              {s === "All" ? "All States" : s}
            </option>
          ))}
        </select>

        <select
          className="state-filter"
          value={iterationFilter}
          onChange={(e) => onIterationFilterChange(e.target.value)}
        >
          <option value="All">All Iterations</option>
          {iterations.map((it) => (
            <option key={it} value={it}>{it}</option>
          ))}
        </select>
      </div>

      <div className="toolbar-right">
        {lastRefresh && (
          <span className="refresh-time">
            Updated {lastRefresh.toLocaleTimeString()}
          </span>
        )}
        <button className="btn-icon" onClick={onRefresh} disabled={loading} title="Refresh">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>
        <button className="btn-icon btn-danger" onClick={onDisconnect} title="Disconnect">
          Disconnect
        </button>
      </div>
    </div>
  );
}
