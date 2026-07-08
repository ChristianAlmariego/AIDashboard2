import { useState } from "react";
import StoryCard from "./StoryCard";
import { countByState, STATE_COLORS, STATE_ORDER, totalPoints } from "../utils/grouping";

export default function GroupSection({ label, stories, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const counts = countByState(stories);
  const pts = totalPoints(stories);

  return (
    <div className="group-section">
      <button className="group-header" onClick={() => setOpen((o) => !o)}>
        <span className="group-chevron">{open ? "▾" : "▸"}</span>
        <span className="group-label">{label}</span>
        <div className="group-pills">
          {STATE_ORDER.map((s) =>
            counts[s] ? (
              <span
                key={s}
                className="state-pill"
                style={{ background: STATE_COLORS[s] + "22", color: STATE_COLORS[s], borderColor: STATE_COLORS[s] + "55" }}
              >
                {s}: {counts[s]}
              </span>
            ) : null
          )}
          {pts > 0 && <span className="state-pill pts-pill">{pts} pts</span>}
        </div>
        <span className="group-count">{stories.length} stories</span>
      </button>

      {open && (
        <div className="group-body">
          <div className="story-grid">
            {stories.map((s) => (
              <StoryCard key={s.id} story={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
