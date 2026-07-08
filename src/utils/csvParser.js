function parseLine(line) {
  const fields = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { field += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(field); field = "";
    } else {
      field += ch;
    }
  }
  fields.push(field);
  return fields;
}

function cleanName(raw) {
  if (!raw || !raw.trim()) return "Unassigned";
  // Strip email "<...>"
  const emailIdx = raw.indexOf("<");
  let name = emailIdx >= 0 ? raw.slice(0, emailIdx).trim() : raw.trim();
  // "Last, First Middle [TAGS]" → "First Middle Last"
  const commaIdx = name.indexOf(",");
  if (commaIdx >= 0) {
    const last = name.slice(0, commaIdx).trim();
    const rest = name.slice(commaIdx + 1).trim();
    // Drop all-caps acronym tokens (EMR, ISV, etc.)
    const firstParts = rest.split(/\s+/).filter(
      (w) => !/^[A-Z]{2,4}$/.test(w)
    );
    return [...firstParts, last].join(" ");
  }
  return name;
}

function mapPriority(val) {
  const n = parseInt(val, 10);
  return !isNaN(n) && n >= 1 && n <= 4 ? `P${n}` : null;
}

export function parseAdoCsv(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const rows = lines.map(parseLine);
  if (rows.length < 2) return {};

  const headers = rows[0].map((h) => h.trim());
  const idx = {};
  headers.forEach((h, i) => { idx[h] = i; });

  const get = (row, col) => (row[idx[col]] ?? "").trim();

  const items = rows.slice(1)
    .filter((row) => {
      const t = get(row, "Work Item Type");
      return t === "User Story" || t === "Task";
    })
    .map((row) => ({
      id: get(row, "ID"),
      type: get(row, "Work Item Type"),
      title: get(row, "Title 2") || get(row, "Title 1"),
      priority: mapPriority(get(row, "Priority")),
      state: get(row, "State"),
      assignee: cleanName(get(row, "Assigned To")),
      iterationPath: get(row, "Iteration Path"),
      areaPath: get(row, "Area Path"),
    }));

  // Positional parent-child: Task immediately after a User Story belongs to it
  const grouped = {};
  let currentStory = null;

  for (const item of items) {
    if (item.type === "User Story") {
      currentStory = { ...item, tasks: [] };
      const key = item.assignee;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(currentStory);
    } else if (item.type === "Task" && currentStory) {
      currentStory.tasks.push(item);
    }
  }

  // Sort assignees alphabetically
  return Object.fromEntries(
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b))
  );
}
