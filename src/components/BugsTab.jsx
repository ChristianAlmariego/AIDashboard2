import { useState, useMemo } from "react";
import { shortIteration } from "../utils/grouping";
import { parseFeatureId, fetchFeatureBugs } from "../api/adoBugs";

const BUG_STATUS = {
  "Active":   { bg: "#fde8e8", border: "#dc3545", text: "#721c24", icon: "🐛" },
  "New":      { bg: "#e9ecef", border: "#adb5bd", text: "#495057", icon: "⬜" },
  "Resolved": { bg: "#d4edda", border: "#28a745", text: "#155724", icon: "✅" },
  "Closed":   { bg: "#d1ecf1", border: "#17a2b8", text: "#0c5460", icon: "🔒" },
};

const PRIORITY = {
  1: { bg: "#dc3545", text: "#fff", label: "P1 – Critical" },
  2: { bg: "#fd7e14", text: "#fff", label: "P2 – High" },
  3: { bg: "#ffc107", text: "#212529", label: "P3 – Medium" },
  4: { bg: "#6c757d", text: "#fff", label: "P4 – Low" },
};

function bugStatus(state) {
  return BUG_STATUS[state] || { bg: "#e9ecef", border: "#adb5bd", text: "#495057", icon: "⬜" };
}

function BugRow({ bug }) {
  const sc = bugStatus(bug.state);
  const pc = bug.priority ? PRIORITY[bug.priority] : null;

  return (
    <div className="brow" style={{ borderLeftColor: sc.border }}>
      <span className="brow-icon">{sc.icon}</span>
      <a href={bug.url} target="_blank" rel="noreferrer" className="brow-title">{bug.title}</a>
      <span className="brow-id">#{bug.id}</span>
      <span
        className="brow-status"
        style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}
      >
        {bug.state}
      </span>
      {pc && (
        <span className="brow-priority" style={{ background: pc.bg, color: pc.text }}>
          {pc.label}
        </span>
      )}
      {bug.severity && <span className="brow-severity">{bug.severity}</span>}
    </div>
  );
}

function BugSection({ title, bugs, accentColor }) {
  if (!bugs.length) return null;
  return (
    <div className="bsection">
      <div className="bsection-hdr" style={{ borderLeftColor: accentColor }}>
        <span className="bsection-title">{title}</span>
        <span className="bsection-count">{bugs.length} {bugs.length === 1 ? "bug" : "bugs"}</span>
      </div>
      <div className="bsection-list">
        {bugs.map((b) => <BugRow key={b.id} bug={b} />)}
      </div>
    </div>
  );
}

function StoryCard({ story }) {
  const sc = bugStatus(story.state);
  const pc = story.priority ? PRIORITY[story.priority] : null;
  const total = story.commerceBugs.length + story.contentBugs.length + story.otherBugs.length;

  return (
    <div className="story-bug-card" style={{ borderTopColor: sc.border }}>
      <div className="sbc-header">
        <div className="sbc-title-row">
          <a href={story.url} target="_blank" rel="noreferrer" className="sbc-link">
            #{story.id} · {story.title}
          </a>
          <div className="sbc-badges">
            <span className="sbc-status" style={{ background: sc.bg, color: sc.text, borderColor: sc.border }}>
              {story.state}
            </span>
            {pc && (
              <span className="sbc-priority" style={{ background: pc.bg, color: pc.text }}>
                {pc.label}
              </span>
            )}
          </div>
        </div>
        <div className="sbc-meta">
          {story.assignee}
          {story.iterationPath ? ` · ${shortIteration(story.iterationPath)}` : ""}
          {" · "}<strong>{total}</strong> {total === 1 ? "bug" : "bugs"}
        </div>
      </div>

      {total > 0 ? (
        <div className="sbc-body">
          <BugSection title="Commerce" bugs={story.commerceBugs} accentColor="#0078d4" />
          <BugSection title="Content" bugs={story.contentBugs} accentColor="#6f42c1" />
          {story.otherBugs.length > 0 && (
            <BugSection title="Other" bugs={story.otherBugs} accentColor="#6c757d" />
          )}
        </div>
      ) : (
        <div className="sbc-empty">No bugs linked to this story.</div>
      )}
    </div>
  );
}

export default function BugsTab({ pat }) {
  const [featureUrl, setFeatureUrl] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [iterationFilter, setIterationFilter] = useState("All");

  async function handleLoad() {
    const id = parseFeatureId(featureUrl);
    if (!id) { setError("Could not parse a work item ID from the URL. Paste the full ADO URL or just the numeric ID."); return; }
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const result = await fetchFeatureBugs(pat, id);
      setData(result);
      setIterationFilter("All");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  const iterations = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.stories.map((s) => shortIteration(s.iterationPath)).filter(Boolean));
    return [...set].sort();
  }, [data]);

  const byIteration = useMemo(() => {
    if (!data) return [];
    const stories = iterationFilter === "All"
      ? data.stories
      : data.stories.filter((s) => shortIteration(s.iterationPath) === iterationFilter);
    const map = new Map();
    for (const s of stories) {
      const key = shortIteration(s.iterationPath) || "No Iteration";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data, iterationFilter]);

  return (
    <div className="bugs-tab">
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
          <button
            className="dash-btn"
            onClick={handleLoad}
            disabled={loading || !featureUrl.trim()}
          >
            {loading ? "Loading…" : "Load Feature"}
          </button>
        </div>
        {error && <div className="bugs-error">{error}</div>}
      </div>

      {!data && !loading && (
        <div className="bugs-placeholder">
          Enter a Feature URL or ID above to view its user stories and bugs grouped by iteration.
        </div>
      )}

      {data && (
        <>
          <div className="bugs-feature-header">
            <a href={data.feature.url} target="_blank" rel="noreferrer" className="bugs-feature-link">
              📦 {data.feature.title}
            </a>
            <span className="bugs-feature-meta">
              Feature #{data.feature.id} · {data.stories.length} user {data.stories.length === 1 ? "story" : "stories"}
            </span>
          </div>

          {iterations.length > 1 && (
            <div className="bugs-iter-bar">
              {["All", ...iterations].map((it) => (
                <button
                  key={it}
                  className={`iter-chip${iterationFilter === it ? " active" : ""}`}
                  onClick={() => setIterationFilter(it)}
                >
                  {it}
                </button>
              ))}
            </div>
          )}

          {byIteration.length === 0 && (
            <div className="empty-state">No user stories found for this feature.</div>
          )}

          {byIteration.map(([iteration, stories]) => (
            <div key={iteration} className="bugs-iter-group">
              <div className="bugs-iter-label">
                🗓 {iteration}
                <span className="bugs-iter-count">{stories.length} {stories.length === 1 ? "story" : "stories"}</span>
              </div>
              <div className="bugs-story-list">
                {stories.map((s) => <StoryCard key={s.id} story={s} />)}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
