import { getStateColor } from "../utils/grouping";

const PRIORITY_LABELS = { 1: "Critical", 2: "High", 3: "Medium", 4: "Low" };
const PRIORITY_COLORS = { 1: "#a80000", 2: "#d83b01", 3: "#0078d4", 4: "#107c10" };

export default function StoryCard({ story }) {
  const stateColor = getStateColor(story.state);
  const shortIter = story.iterationPath.split("\\").pop() || story.iterationPath;

  return (
    <a href={story.url} target="_blank" rel="noreferrer" className="story-card">
      <div className="card-top">
        <span className="card-id">#{story.id}</span>
        <span className="card-state" style={{ background: stateColor + "22", color: stateColor, borderColor: stateColor + "44" }}>
          {story.state}
        </span>
      </div>
      <div className="card-title">{story.title}</div>
      <div className="card-meta">
        {story.storyPoints != null && (
          <span className="meta-chip points">{story.storyPoints} pts</span>
        )}
        {story.priority != null && (
          <span className="meta-chip priority" style={{ color: PRIORITY_COLORS[story.priority] }}>
            {PRIORITY_LABELS[story.priority] ?? `P${story.priority}`}
          </span>
        )}
        <span className="meta-chip iter">{shortIter}</span>
      </div>
    </a>
  );
}
