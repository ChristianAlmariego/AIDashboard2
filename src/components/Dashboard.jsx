import AssigneeCard from "./AssigneeCard";

const LEGEND = [
  { color: "#f0c940", label: "In Progress Dev" },
  { color: "#17a2b8", label: "QA Test" },
  { color: "#e74c3c", label: "QA Test Failed / Blocked" },
  { color: "#9b59b6", label: "Waiting for Stage Deploy" },
  { color: "#adb5bd", label: "New" },
  { color: "#2ecc71", label: "Complete/Done (tasks)" },
];

function formatDate(d) {
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default function Dashboard({ data, fileName, onReset }) {
  const today = new Date();
  const todayStr = formatDate(today);
  const entries = Object.entries(data);

  return (
    <div className="dash-wrap">
      <header className="dash-header">
        <div>
          <div className="dash-title">📋 QA Team Daily Dashboard — User Stories</div>
          <div className="dash-sub">Emerson Digital Modernization · PI 26.4 · Sprint 26.4.1</div>
        </div>
        <div className="dash-header-right">
          <div className="dash-date">📅 {todayStr}</div>
          <button className="btn-reset" onClick={onReset} title="Load a different CSV">↩ New File</button>
        </div>
      </header>

      <div className="dash-legend">
        {LEGEND.map((l) => (
          <span key={l.label} className="legend-item">
            <span className="legend-dot" style={{ background: l.color }} />
            {l.label}
          </span>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="empty-state">
          No User Stories found in <strong>{fileName}</strong>. Check that the file
          includes a "Work Item Type" column with "User Story" rows.
        </div>
      ) : (
        <div className="dash-grid">
          {entries.map(([name, stories]) => (
            <AssigneeCard key={name} name={name} stories={stories} todayStr={todayStr} />
          ))}
        </div>
      )}

      <div className="dash-footer">
        <span>QA Team Dashboard · EMR-DigMod · PI 26.4 · Sprint 26.4.1 · Source: {fileName}</span>
        <span>Draft for human review — verify figures before sharing</span>
      </div>
    </div>
  );
}
