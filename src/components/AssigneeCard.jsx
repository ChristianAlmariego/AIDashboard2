const S_CFG = {
  "In Progress Dev":          { cls: "s-prog",  badge: "pill-prog",  icon: "🔄", label: "In Progress Dev",          border: "#f0a500" },
  "QA Test":                  { cls: "s-test",  badge: "pill-test",  icon: "🧪", label: "QA Test",                  border: "#17a2b8" },
  "QA Test Failed":           { cls: "s-fail",  badge: "pill-fail",  icon: "❌", label: "QA Test Failed",           border: "#dc3545" },
  "Waiting for Stage Deploy": { cls: "s-wait",  badge: "pill-wait",  icon: "⏸", label: "Waiting for Stage Deploy", border: "#9b59b6" },
  "Blocked":                  { cls: "s-blk",   badge: "pill-blk",   icon: "🚫", label: "Blocked",                  border: "#dc3545" },
  "New":                      { cls: "s-new",   badge: "pill-new",   icon: "⬜", label: "New",                      border: "#adb5bd" },
};
const T_CFG = {
  "In Progress":    { cls: "t-prog", badge: "tb-prog", icon: "🔄", label: "In Progress" },
  "Complete/Done":  { cls: "t-done", badge: "tb-done", icon: "✅", label: "Done" },
  "New":            { cls: "t-new",  badge: "tb-new",  icon: "⬜", label: "New" },
};
const STATUS_COLORS = {
  "In Progress Dev": "#856404", "QA Test": "#0c5460", "QA Test Failed": "#721c24",
  "Waiting for Stage Deploy": "#6a1b9a", "Blocked": "#721c24", "New": "#495057",
};

function sc(s) { return S_CFG[s] || { cls: "s-new", badge: "pill-new", icon: "⬜", label: s, border: "#adb5bd" }; }
function tc(s) { return T_CFG[s] || { cls: "t-new", badge: "tb-new",  icon: "⬜", label: s }; }

export default function AssigneeCard({ name, stories, todayStr }) {
  const counts = {};
  stories.forEach((s) => { counts[s.state] = (counts[s.state] || 0) + 1; });

  const pillsHTML = Object.entries(counts).map(([st, n]) => {
    const c = sc(st);
    return <span key={st} className={`pill ${c.badge}`}>{n} {c.label}</span>;
  });

  const sumEntries = [
    ["Total", stories.length, "#003865"],
    ...Object.entries(counts).map(([st, n]) => [
      st === "Waiting for Stage Deploy" ? "Waiting" : st,
      n,
      STATUS_COLORS[st] || "#495057",
    ]),
  ];

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-name">{name}</div>
          <div className="card-meta">EMR-DigMod · QA · {todayStr}</div>
        </div>
        <div className="pills">{pillsHTML}</div>
      </div>

      <div className="card-body">
        <div className="summary-bar">
          {sumEntries.map(([lbl, n, col]) => (
            <div key={lbl} className="sbar-item">
              <div className="snum" style={{ color: col }}>{n}</div>
              <div className="slbl">{lbl}</div>
            </div>
          ))}
        </div>

        <div className="section-label">📖 User Stories</div>

        {stories.map((story) => {
          const c = sc(story.state);
          const hasTasks = story.tasks && story.tasks.length > 0;
          const sub = ["#" + story.id, story.priority ? `P${story.priority}` : null].filter(Boolean).join(" · ");

          return (
            <div key={story.id} className="story-block" style={{ borderLeftColor: c.border }}>
              <div className={`story-row ${c.cls}`}>
                <span className="story-icon">{c.icon}</span>
                <div className="story-text">
                  <div className="s-title">{story.title}</div>
                  <div className="s-subtitle">{sub}</div>
                </div>
                <span className={`story-badge ${c.badge}`}>{c.label}</span>
              </div>

              {hasTasks && (
                <div className="task-list">
                  {story.tasks.map((task) => {
                    const t = tc(task.state);
                    const isDiffOwner = task.assignee && task.assignee !== name;
                    const firstName = isDiffOwner ? task.assignee.split(" ")[0] : null;
                    return (
                      <div key={task.id} className={`task-row ${t.cls}`}>
                        <span className="task-icon">{t.icon}</span>
                        <span className="task-text">{task.title}</span>
                        {firstName && <span className="assignee-tag">{firstName}</span>}
                        <span className="task-id">#{task.id}</span>
                        <span className={`task-badge ${t.badge}`}>{t.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
