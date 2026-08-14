import { useMemo } from "react";
import { shortIteration } from "../utils/grouping";

const DONE_STATES = new Set(["Complete/Done", "Closed"]);

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

function pts(list) { return list.reduce((s, x) => s + (x.storyPoints ?? 0), 0); }

function StoryRow({ story }) {
  const cfg = stateCfg(story.state);
  const isDone = DONE_STATES.has(story.state);
  return (
    <tr className={`vel-story-row${isDone ? " vel-story-done" : " vel-story-open"}`}>
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
  const donePts   = pts(stories.filter((s) => DONE_STATES.has(s.state)));
  const openPts   = pts(stories.filter((s) => !DONE_STATES.has(s.state)));
  const totalPts  = pts(stories);

  // Sort: open first, then done
  const sorted = [...stories].sort((a, b) => {
    const ad = DONE_STATES.has(a.state) ? 1 : 0;
    const bd = DONE_STATES.has(b.state) ? 1 : 0;
    return ad - bd;
  });

  return (
    <div className="vel-iter-block">
      <div className="vel-iter-hdr">
        <span className="vel-iter-name">🗓 {iteration}</span>
        <span className="vel-iter-meta">
          {stories.length} {stories.length === 1 ? "story" : "stories"}
          {donePts > 0 && <> · <span className="vel-iter-done">{donePts} velocity pts</span></>}
          {openPts > 0 && <> · <span className="vel-iter-open">{openPts} unclosed pts</span></>}
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
          {sorted.map((s) => <StoryRow key={s.id} story={s} />)}
        </tbody>
      </table>
    </div>
  );
}

function MemberCard({ name, stories }) {
  const velocityPts = pts(stories.filter((s) => DONE_STATES.has(s.state)));
  const unclosedPts = pts(stories.filter((s) => !DONE_STATES.has(s.state)));
  const totalStories = stories.length;

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
            {totalStories} {totalStories === 1 ? "story" : "stories"}
          </div>
        </div>
        <div className="vel-member-kpis">
          <div className="vel-kpi">
            <span className="vel-kpi-val" style={{ color: "#28a745" }}>{velocityPts}</span>
            <span className="vel-kpi-lbl">Velocity Pts</span>
          </div>
          <div className="vel-kpi vel-kpi-divider">
            <span className="vel-kpi-val" style={{ color: "#d39e00" }}>{unclosedPts}</span>
            <span className="vel-kpi-lbl">Unclosed Pts</span>
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

  const totalVelocityPts = pts(stories.filter((s) => DONE_STATES.has(s.state)));
  const totalUnclosedPts = pts(stories.filter((s) => !DONE_STATES.has(s.state)));

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
        <div className="vel-summary-tile" style={{ borderTopColor: "#28a745" }}>
          <span className="vel-summary-val" style={{ color: "#28a745" }}>{totalVelocityPts}</span>
          <span className="vel-summary-lbl">Velocity Pts</span>
          <span className="vel-summary-sub">closed / done</span>
        </div>
        <div className="vel-summary-tile" style={{ borderTopColor: "#d39e00" }}>
          <span className="vel-summary-val" style={{ color: "#d39e00" }}>{totalUnclosedPts}</span>
          <span className="vel-summary-lbl">Unclosed Pts</span>
          <span className="vel-summary-sub">in progress / open</span>
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
