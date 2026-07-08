export const STATE_COLORS = {
  "New": "#6c757d",
  "Active": "#0078d4",
  "Resolved": "#8a44c8",
  "Closed": "#107c10",
  "Removed": "#a80000",
};

export const STATE_ORDER = ["New", "Active", "Resolved", "Closed"];

export function getStateColor(state) {
  return STATE_COLORS[state] ?? "#6c757d";
}

export function groupByAssignee(stories) {
  const map = {};
  for (const s of stories) {
    const key = s.assignee;
    if (!map[key]) map[key] = [];
    map[key].push(s);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export function groupByIteration(stories) {
  const map = {};
  for (const s of stories) {
    const key = s.iterationPath || "No Iteration";
    if (!map[key]) map[key] = [];
    map[key].push(s);
  }
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}

export function countByState(stories) {
  const counts = {};
  for (const s of stories) {
    counts[s.state] = (counts[s.state] ?? 0) + 1;
  }
  return counts;
}

export function totalPoints(stories) {
  return stories.reduce((sum, s) => sum + (s.storyPoints ?? 0), 0);
}

export function shortIteration(path) {
  const parts = path.split("\\");
  return parts[parts.length - 1] || path;
}
