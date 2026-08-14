import { useMemo } from "react";
import { shortIteration } from "../utils/grouping";

const STATE_COLORS = {
  "New":                      { bg: "#e9ecef", border: "#adb5bd", text: "#495057" },
  "In Progress Dev":          { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" },
  "QA Test":                  { bg: "#d1ecf1", border: "#17a2b8", text: "#0c5460" },
  "QA Test Failed":           { bg: "#f8d7da", border: "#dc3545", text: "#721c24" },
  "Waiting for Stage Deploy": { bg: "#ede0f7", border: "#9b59b6", text: "#5e2a8a" },
  "Waiting for Prod Deploy":  { bg: "#e8f4fd", border: "#0078d4", text: "#004e8c" },
  "Stage Test":               { bg: "#fce4ff", border: "#c678dd", text: "#6a0dad" },
  "Blocked":                  { bg: "#f8d7da", border: "#dc3545", text: "#721c24" },
  "Complete/Done":            { bg: "#d4edda", border: "#28a745", text: "#155724" },
  "Closed":                   { bg: "#d4edda", border: "#28a745", text: "#155724" },
};

function stateCfg(state) {
  return STATE_COLORS[state] || { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
}

function StoryRow({ story }) {
  const cfg = stateCfg(story.state);
  return (
    <tr className="vel-story-row">
      <td>
        <a href={story.url} target="_blank" rel="noreferrer" className="vel-id-link">
          #{story.id}
        </a>
      </td>
      <td>
        <a href={story.url} target="_blank" rel="noreferrer" className="vel-title-link">
          {story.title}
        </a>
      </td>
      <td>
        <span className="vel-state-badge" style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
          {story.state}
        </span>
      </td>
      <td className="vel-pts-cell">{story.storyPoints ?? "—"}</td>
    </tr>
  );
}

function IterationBlock({ iteration, stories }) {
  const pts = stories.reduce((s, x) => s + (x.storyPoints ?? 0), 0);
  return (
    <div className="vel-iter-block">
      <div className="vel-iter-hdr">
        <span className="vel-iter-name">🗓 {iteration}</span>
        <span className="vel-iter-meta">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
          {pts > 0 && <> · <strong>{pts} pts</strong></>}
        </span>
      </div>
      <table className="vel-table">
        <colgroup>
          <col style={{ width: "90px" }} />
          <col />
          <col style={{ width: "200px" }} />
          <col style={{ width: "52px" }} />
        </colgroup>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Pts</th>
          </tr>
        </thead>
        <tbody>
          {stories.map((s) => <StoryRow key={s.id} story={s} />)}
        </tbody>
      </table>
    </div>
  );
}

function MemberCard({ name, stories, iterations }) {
  const totalPts = stories.reduce((s, x) => s + (x.storyPoints ?? 0), 0);
  const totalStories = stories.length;
  const completedPts = stories
    .filter((s) => ["Complete/Done", "Closed"].includes(s.state))
    .reduce((s, x) => s + (x.storyPoints ?? 0), 0);

  const byIteration = useMemo(() => {
    const map = new Map();
    for (const s of stories) {
      const it = shortIteration(s.iterationPath) || "No Iteration";
      if (!map.has(it)) map.set(it, []);
      map.get(it).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stories]);

  const initials = name
    .split(" ")
    .filter((p) => p.length > 0)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  return (
    <div className="vel-member-card">
      <div className="vel-member-hdr">
        <div className="vel-member-avatar">{initials || "?"}</div>
        <div className="vel-member-info">
          <div className="vel-member-name">{name}</div>
          <div className="vel-member-sub">
            {totalStories} {totalStories === 1 ? "story" : "stories"} · {totalPts} total pts
          </div>
        </div>
        <div className="vel-member-kpis">
          <div className="vel-kpi">
            <span className="vel-kpi-val">{totalPts}</span>
            <span className="vel-kpi-lbl">Total Pts</span>
          </div>
          <div className="vel-kpi">
            <span className="vel-kpi-val" style={{ color: "#28a745" }}>{completedPts}</span>
            <span className="vel-kpi-lbl">Done Pts</span>
          </div>
          <div className="vel-kpi">
            <span className="vel-kpi-val" style={{ color: "#0078d4" }}>{totalStories}</span>
            <span className="vel-kpi-lbl">Stories</span>
          </div>
        </div>
      </div>
      <div className="vel-member-body">
        {byIteration.map(([it, strs]) => (
          <IterationBlock key={it} iteration={it} stories={strs} />
        ))}
      </div>
    </div>
  );
}

export default function VelocityTab({ stories }) {
  const byMember = useMemo(() => {
    const map = new Map();
    for (const s of stories) {
      const key = s.assignee || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [stories]);

  const grandTotal = stories.reduce((s, x) => s + (x.storyPoints ?? 0), 0);

  const iterations = useMemo(() => {
    const set = new Set(stories.map((s) => shortIteration(s.iterationPath)).filter(Boolean));
    return [...set].sort();
  }, [stories]);

  if (stories.length === 0) {
    return <div className="empty-state">No stories available. Connect and load data first.</div>;
  }

  return (
    <div className="vel-tab">
      {/* Summary bar */}
      <div className="vel-summary-bar">
        <div className="vel-summary-tile">
          <span className="vel-summary-val">{stories.length}</span>
          <span className="vel-summary-lbl">Total Stories</span>
        </div>
        <div className="vel-summary-tile" style={{ borderTopColor: "#0078d4" }}>
          <span className="vel-summary-val" style={{ color: "#0078d4" }}>{grandTotal}</span>
          <span className="vel-summary-lbl">Total Story Points</span>
        </div>
        <div className="vel-summary-tile" style={{ borderTopColor: "#9b59b6" }}>
          <span className="vel-summary-val" style={{ color: "#9b59b6" }}>{byMember.length}</span>
          <span className="vel-summary-lbl">Team Members</span>
        </div>
        <div className="vel-summary-tile" style={{ borderTopColor: "#17a2b8" }}>
          <span className="vel-summary-val" style={{ color: "#17a2b8" }}>{iterations.length}</span>
          <span className="vel-summary-lbl">Iterations</span>
        </div>
      </div>

      {/* Per-member cards */}
      <div className="vel-members">
        {byMember.map(([name, memberStories]) => (
          <MemberCard key={name} name={name} stories={memberStories} />
        ))}
      </div>
    </div>
  );
}
