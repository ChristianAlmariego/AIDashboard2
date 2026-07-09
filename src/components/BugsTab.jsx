import { useState, useMemo } from "react";
import { shortIteration } from "../utils/grouping";
import { parseFeatureId, fetchFeatureBugs } from "../api/adoBugs";

// ─── Config ──────────────────────────────────────────────────────────────────

const STATUS_CFG = {
  "New":               { color: "#495057", bg: "#e9ecef", border: "#adb5bd", icon: "⚪", order: 0 },
  "Ready for Dev":     { color: "#fff",    bg: "#0078d4", border: "#005ea2", icon: "🔷", order: 1 },
  "In Progress Dev":   { color: "#7a5700", bg: "#fff3cd", border: "#f0c040", icon: "🔄", order: 2 },
  "Stage Test":        { color: "#fff",    bg: "#9b59b6", border: "#7d3c98", icon: "🧪", order: 3 },
  "Complete/Done":     { color: "#fff",    bg: "#28a745", border: "#1e7e34", icon: "✅", order: 4 },
  // Fallbacks for any other ADO statuses
  "Active":            { color: "#fff",    bg: "#dc3545", border: "#b02a37", icon: "🔴", order: 5 },
  "Resolved":          { color: "#fff",    bg: "#28a745", border: "#1e7e34", icon: "🟢", order: 6 },
  "Closed":            { color: "#fff",    bg: "#17a2b8", border: "#138496", icon: "🔵", order: 7 },
};

const PRIORITY_CFG = {
  1: { color: "#fff",     bg: "#dc3545", border: "#b02a37", label: "P1", desc: "Critical", order: 1 },
  2: { color: "#fff",     bg: "#fd7e14", border: "#d96900", label: "P2", desc: "High",     order: 2 },
  3: { color: "#212529",  bg: "#ffc107", border: "#d39e00", label: "P3", desc: "Medium",   order: 3 },
  4: { color: "#fff",     bg: "#6c757d", border: "#545b62", label: "P4", desc: "Low",      order: 4 },
};

const STATUS_ORDER = {
  "New": 0, "Ready for Dev": 1, "In Progress Dev": 2, "Stage Test": 3, "Complete/Done": 4,
  "Active": 5, "Resolved": 6, "Closed": 7,
};

function sc(state)    { return STATUS_CFG[state]    || { color: "#495057", bg: "#e9ecef", border: "#adb5bd", icon: "⚪", order: 99 }; }
function pc(priority) { return PRIORITY_CFG[priority] || { color: "#fff", bg: "#6c757d", border: "#545b62", label: `P${priority}`, desc: "", order: 99 }; }

function sortBugs(bugs) {
  return [...bugs].sort((a, b) => {
    const pa = a.priority ?? 99, pb = b.priority ?? 99;
    if (pa !== pb) return pa - pb;
    const sa = STATUS_ORDER[a.state] ?? 99, sb = STATUS_ORDER[b.state] ?? 99;
    if (sa !== sb) return sa - sb;
    return a.id - b.id;
  });
}

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── KPI Cards ───────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, sub }) {
  return (
    <div className="kpi-card" style={{ borderTopColor: color }}>
      <div className="kpi-value" style={{ color }}>{value}</div>
      <div className="kpi-label">{label}</div>
      {sub != null && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

// ─── Bug Card ────────────────────────────────────────────────────────────────

function BugCard({ bug, storyTitle }) {
  const s = sc(bug.state);
  const p = pc(bug.priority);
  return (
    <div className="bug-card" style={{ borderLeftColor: p.bg }}>
      <div className="bug-card-top">
        <div className="bug-card-badges">
          <span className="bug-priority-badge" style={{ background: p.bg, color: p.color, borderColor: p.border }}>
            {p.label} <span className="bug-priority-desc">{p.desc}</span>
          </span>
          <span className="bug-status-badge" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
            {s.icon} {bug.state}
          </span>
        </div>
        <a href={bug.url} target="_blank" rel="noreferrer" className="bug-id-link">#{bug.id}</a>
      </div>

      <a href={bug.url} target="_blank" rel="noreferrer" className="bug-title">{bug.title}</a>

      <div className="bug-meta-grid">
        <div className="bug-meta-item"><span className="bug-meta-lbl">Assigned</span><span>{bug.assignee}</span></div>
        <div className="bug-meta-item"><span className="bug-meta-lbl">Iteration</span><span>{shortIteration(bug.iterationPath) || "—"}</span></div>
        <div className="bug-meta-item"><span className="bug-meta-lbl">Parent Story</span><span>{storyTitle}</span></div>
        <div className="bug-meta-item"><span className="bug-meta-lbl">Created</span><span>{fmtDate(bug.createdDate)}</span></div>
      </div>
    </div>
  );
}

// ─── Bug Section (Content / Commerce) ────────────────────────────────────────

function BugSection({ title, bugs, accentColor, icon, storyTitle }) {
  if (!bugs.length) return null;
  return (
    <div className="bug-section">
      <div className="bug-section-hdr" style={{ color: accentColor, borderBottomColor: accentColor }}>
        <span className="bug-section-icon">{icon}</span>
        <span className="bug-section-name">{title} Bugs</span>
        <span className="bug-section-badge" style={{ background: accentColor }}>{bugs.length}</span>
      </div>
      <div className="bug-section-list">
        {bugs.map((b) => <BugCard key={b.id} bug={b} storyTitle={storyTitle} />)}
      </div>
    </div>
  );
}

// ─── User Story Block ─────────────────────────────────────────────────────────

function StoryBlock({ story, filterFn }) {
  const filtered = {
    commerce: sortBugs(story.commerceBugs.filter(filterFn)),
    content:  sortBugs(story.contentBugs.filter(filterFn)),
    other:    sortBugs(story.otherBugs.filter(filterFn)),
  };
  const total = filtered.commerce.length + filtered.content.length + filtered.other.length;
  if (total === 0) return null;

  const storyTitle = `#${story.id} ${story.title}`;

  return (
    <div className="story-block-wrap">
      <div className="story-block-hdr">
        <div className="story-block-left">
          <span className="story-block-icon">📖</span>
          <a href={story.url} target="_blank" rel="noreferrer" className="story-block-link">
            #{story.id} · {story.title}
          </a>
        </div>
        <div className="story-block-right">
          <span className="story-block-assignee">{story.assignee}</span>
          <span className="story-bug-count">{total} {total === 1 ? "bug" : "bugs"}</span>
        </div>
      </div>
      <div className="story-block-body">
        <BugSection title="Commerce" bugs={filtered.commerce} accentColor="#0078d4" icon="🛒" storyTitle={storyTitle} />
        <BugSection title="Content"  bugs={filtered.content}  accentColor="#6f42c1" icon="📝" storyTitle={storyTitle} />
        {filtered.other.length > 0 && (
          <BugSection title="Other" bugs={filtered.other} accentColor="#6c757d" icon="🔧" storyTitle={storyTitle} />
        )}
      </div>
    </div>
  );
}

// ─── Iteration Group ──────────────────────────────────────────────────────────

function IterGroup({ iteration, stories, filterFn }) {
  const allBugs = stories.flatMap((s) => [
    ...s.commerceBugs, ...s.contentBugs, ...s.otherBugs,
  ]).filter(filterFn);

  if (allBugs.length === 0) return null;

  return (
    <div className="iter-group">
      <div className="iter-group-hdr">
        <span className="iter-group-icon">🗓</span>
        <span className="iter-group-name">{iteration}</span>
        <span className="iter-group-count">{allBugs.length} {allBugs.length === 1 ? "bug" : "bugs"}</span>
      </div>
      <div className="iter-group-body">
        {stories.map((s) => (
          <StoryBlock key={s.id} story={s} filterFn={filterFn} />
        ))}
      </div>
    </div>
  );
}

// ─── Filter Bar ───────────────────────────────────────────────────────────────

function FilterBar({ filters, onChange, options }) {
  function sel(key, val) { onChange({ ...filters, [key]: val }); }

  return (
    <div className="bugs-filter-bar">
      <div className="bugs-filter-group">
        <label className="bugs-filter-lbl">Status</label>
        <select className="bugs-filter-sel" value={filters.status} onChange={(e) => sel("status", e.target.value)}>
          <option value="All">All Statuses</option>
          {options.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="bugs-filter-group">
        <label className="bugs-filter-lbl">Priority</label>
        <select className="bugs-filter-sel" value={filters.priority} onChange={(e) => sel("priority", e.target.value)}>
          <option value="All">All Priorities</option>
          {options.priorities.map((p) => <option key={p} value={p}>{PRIORITY_CFG[p]?.label || `P${p}`} – {PRIORITY_CFG[p]?.desc || ""}</option>)}
        </select>
      </div>
      <div className="bugs-filter-group">
        <label className="bugs-filter-lbl">Iteration</label>
        <select className="bugs-filter-sel" value={filters.iteration} onChange={(e) => sel("iteration", e.target.value)}>
          <option value="All">All Iterations</option>
          {options.iterations.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
      </div>
      <div className="bugs-filter-group">
        <label className="bugs-filter-lbl">Assigned To</label>
        <select className="bugs-filter-sel" value={filters.assignee} onChange={(e) => sel("assignee", e.target.value)}>
          <option value="All">All Assignees</option>
          {options.assignees.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      <div className="bugs-filter-group">
        <label className="bugs-filter-lbl">Type</label>
        <select className="bugs-filter-sel" value={filters.type} onChange={(e) => sel("type", e.target.value)}>
          <option value="All">All Types</option>
          <option value="Commerce">🛒 Commerce</option>
          <option value="Content">📝 Content</option>
        </select>
      </div>
      {Object.values(filters).some((v) => v !== "All") && (
        <button
          className="bugs-filter-clear"
          onClick={() => onChange({ status: "All", priority: "All", iteration: "All", assignee: "All", type: "All" })}
        >
          ✕ Clear Filters
        </button>
      )}
    </div>
  );
}

// ─── Main BugsTab ─────────────────────────────────────────────────────────────

export default function BugsTab({ pat }) {
  const [featureUrl, setFeatureUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({ status: "All", priority: "All", iteration: "All", assignee: "All", type: "All" });

  async function handleLoad() {
    const id = parseFeatureId(featureUrl);
    if (!id) { setError("Could not parse a work item ID. Paste the full ADO Feature URL or just the numeric ID."); return; }
    setLoading(true); setError(null); setData(null);
    try {
      const result = await fetchFeatureBugs(pat, id);
      setData(result);
      setFilters({ status: "All", priority: "All", iteration: "All", assignee: "All", type: "All" });
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  // All bugs flat
  const allBugs = useMemo(() => {
    if (!data) return [];
    return data.stories.flatMap((s) => [
      ...s.commerceBugs.map((b) => ({ ...b, category: "Commerce", storyTitle: s.title })),
      ...s.contentBugs.map((b) => ({ ...b, category: "Content",  storyTitle: s.title })),
      ...s.otherBugs.map((b) => ({ ...b, category: "Other",    storyTitle: s.title })),
    ]);
  }, [data]);

  // Filter options derived from all bugs
  const options = useMemo(() => ({
    statuses:   [...new Set(allBugs.map((b) => b.state))].sort((a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99)),
    priorities: [...new Set(allBugs.map((b) => b.priority).filter(Boolean))].sort((a, b) => a - b),
    iterations: [...new Set(allBugs.map((b) => shortIteration(b.iterationPath)).filter(Boolean))].sort(),
    assignees:  [...new Set(allBugs.map((b) => b.assignee).filter((a) => a !== "Unassigned"))].sort(),
  }), [allBugs]);

  // Filter function applied to each bug
  const filterFn = useMemo(() => (bug) => {
    if (filters.status    !== "All" && bug.state   !== filters.status)    return false;
    if (filters.priority  !== "All" && String(bug.priority) !== filters.priority) return false;
    if (filters.iteration !== "All" && shortIteration(bug.iterationPath) !== filters.iteration) return false;
    if (filters.assignee  !== "All" && bug.assignee !== filters.assignee) return false;
    if (filters.type !== "All" && bug.category !== filters.type) return false;
    return true;
  }, [filters]);

  const kpiFixed = useMemo(() => ({
    total:         allBugs.length,
    new:           allBugs.filter((b) => b.state === "New").length,
    readyForDev:   allBugs.filter((b) => b.state === "Ready for Dev").length,
    inProgressDev: allBugs.filter((b) => b.state === "In Progress Dev").length,
    stageTest:     allBugs.filter((b) => b.state === "Stage Test").length,
    done:          allBugs.filter((b) => b.state === "Complete/Done").length,
  }), [allBugs]);

  // Group stories by iteration
  const byIteration = useMemo(() => {
    if (!data) return [];
    const map = new Map();
    for (const s of data.stories) {
      const it = shortIteration(s.iterationPath) || "No Iteration";
      if (!map.has(it)) map.set(it, []);
      map.get(it).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  return (
    <div className="bugs-tab">
      {/* Feature Input */}
      <div className="bugs-feature-bar">
        <label className="bugs-input-label">Feature Link</label>
        <div className="bugs-input-row">
          <input
            className="bugs-url-input"
            type="text"
            placeholder="Paste ADO Feature URL or work item ID…"
            value={featureUrl}
            onChange={(e) => setFeatureUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && featureUrl.trim() && handleLoad()}
          />
          <button className="dash-btn" onClick={handleLoad} disabled={loading || !featureUrl.trim()}>
            {loading ? "Loading…" : "Load Feature"}
          </button>
        </div>
        {error && <div className="bugs-error">{error}</div>}
      </div>

      {!data && !loading && (
        <div className="bugs-placeholder">
          Enter a Feature URL or ID above to view its user stories and bugs, organized by iteration.
        </div>
      )}

      {data && (
        <>
          {/* Feature Header */}
          <div className="bugs-feature-header">
            <div className="bugs-feature-title-row">
              <span className="bugs-feature-badge">FEATURE</span>
              <a href={data.feature.url} target="_blank" rel="noreferrer" className="bugs-feature-link">
                #{data.feature.id} · {data.feature.title}
              </a>
            </div>
            <span className="bugs-feature-meta">
              {data.stories.length} user {data.stories.length === 1 ? "story" : "stories"} · {kpiFixed.total} {kpiFixed.total === 1 ? "bug" : "bugs"} total
            </span>
          </div>

          {/* KPI Cards */}
          <div className="kpi-row">
            <KpiCard label="Total Bugs"      value={kpiFixed.total}         color="#003865" />
            <KpiCard label="New"             value={kpiFixed.new}           color="#6c757d" />
            <KpiCard label="Ready for Dev"   value={kpiFixed.readyForDev}   color="#0078d4" />
            <KpiCard label="In Progress Dev" value={kpiFixed.inProgressDev} color="#d39e00" />
            <KpiCard label="Stage Test"      value={kpiFixed.stageTest}     color="#9b59b6" />
            <KpiCard label="Complete / Done" value={kpiFixed.done}          color="#28a745" />
          </div>

          {/* Filter Bar */}
          <FilterBar filters={filters} onChange={setFilters} options={options} />

          {/* Hierarchy */}
          <div className="bugs-hierarchy">
            {byIteration.map(([iteration, stories]) => (
              <IterGroup key={iteration} iteration={iteration} stories={stories} filterFn={filterFn} />
            ))}
            {byIteration.length === 0 && (
              <div className="empty-state">No user stories found under this feature.</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
