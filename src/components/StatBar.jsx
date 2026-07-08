import { countByState, STATE_COLORS, STATE_ORDER, totalPoints } from "../utils/grouping";

export default function StatBar({ stories }) {
  const counts = countByState(stories);
  const pts = totalPoints(stories);

  return (
    <div className="stat-bar">
      <div className="stat-tile">
        <span className="stat-value">{stories.length}</span>
        <span className="stat-label">Total Stories</span>
      </div>
      {STATE_ORDER.map((s) =>
        counts[s] != null ? (
          <div key={s} className="stat-tile" style={{ borderTopColor: STATE_COLORS[s] }}>
            <span className="stat-value" style={{ color: STATE_COLORS[s] }}>
              {counts[s]}
            </span>
            <span className="stat-label">{s}</span>
          </div>
        ) : null
      )}
      <div className="stat-tile">
        <span className="stat-value">{pts}</span>
        <span className="stat-label">Story Points</span>
      </div>
    </div>
  );
}
