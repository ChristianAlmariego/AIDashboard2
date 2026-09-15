import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const UTIL_COLOR = (pct) => {
  if (pct > 100) return { bg: "#f8d7da", border: "#dc3545", text: "#721c24" };
  if (pct >= 90) return { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" };
  return { bg: "#d4edda", border: "#28a745", text: "#155724" };
};

const TEAM_COLORS = {
  Commerce: "#3b82f6",
  ICU: "#0ea5e9",
  Automation: "#06b6d4",
  Content: "#0d9488",
};

function parseCapacitySheet(wb) {
  // Try common sheet names for capacity
  const names = wb.SheetNames;
  const capSheet = names.find((n) =>
    /capacity/i.test(n) && !/iteration/i.test(n)
  ) || names.find((n) => /weekly/i.test(n));
  if (!capSheet) return null;

  const ws = wb.Sheets[capSheet];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
  // Look for rows with assignee + numeric capacity values
  const cap = {}; // { assignee: { iter: number } }
  for (const row of rows) {
    const name = String(row[0] || "").trim();
    if (!name || /name|member|assignee/i.test(name)) continue;
    for (let c = 1; c < row.length; c++) {
      const val = row[c];
      if (typeof val === "number" && val > 0) {
        if (!cap[name]) cap[name] = {};
        cap[name][`col${c}`] = val;
      }
    }
  }
  return cap;
}

function parseIterationPlan(wb) {
  const sheetName = wb.SheetNames.find((n) => /iteration.*plan/i.test(n) || /2\)/i.test(n)) || wb.SheetNames[1] || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  if (!ws) return { loads: {}, iterations: [], teams: {} };

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  const loads = {}; // { assignee: { iteration: sp } }
  const teams = {}; // { assignee: Set<team> }
  const iterSet = new Set();

  for (const row of rows) {
    const assignee = String(row[4] || "").trim();
    const iteration = String(row[3] || "").trim();
    const spVal = row[5]; // col F — sub-task SP

    if (!assignee || !iteration) continue;
    if (typeof spVal !== "number") continue;

    if (!loads[assignee]) loads[assignee] = {};
    loads[assignee][iteration] = (loads[assignee][iteration] || 0) + spVal;
    iterSet.add(iteration);

    const team = String(row[1] || "").trim();
    if (team) {
      if (!teams[assignee]) teams[assignee] = new Set();
      teams[assignee].add(team);
    }
  }

  const iterations = [...iterSet].sort();
  return { loads, iterations, teams };
}

// Try to parse capacity from a "Weekly Capacity" or similar sheet
function parseCapacityRows(wb, iterations) {
  const names = wb.SheetNames;
  const sheetName = names.find((n) => /weekly.*cap|capacity.*sp|cap.*sp/i.test(n));
  if (!sheetName) return {};

  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });

  // Find header row — contains iteration names
  let headerRow = null;
  let headerIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const hasIter = iterations.some((it) => r.some((c) => String(c).includes(it)));
    if (hasIter) { headerRow = r; headerIdx = i; break; }
  }
  if (!headerRow) return {};

  const colMap = {}; // col index -> iteration
  headerRow.forEach((c, i) => {
    const s = String(c).trim();
    const match = iterations.find((it) => s.includes(it));
    if (match) colMap[i] = match;
  });

  const cap = {};
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    const name = String(row[0] || "").trim();
    if (!name) continue;
    for (const [ci, iter] of Object.entries(colMap)) {
      const v = row[Number(ci)];
      if (typeof v === "number" && v > 0) {
        if (!cap[name]) cap[name] = {};
        cap[name][iter] = v;
      }
    }
  }
  return cap;
}

export default function CapacityTab() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [err, setErr] = useState("");

  function processFile(file) {
    if (!file) return;
    setErr("");
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = XLSX.read(e.target.result, { type: "array" });
        const { loads, iterations, teams } = parseIterationPlan(wb);
        const cap = parseCapacityRows(wb, iterations);
        setData({ loads, iterations, cap, teams });
        setFileName(file.name);
      } catch (ex) {
        setErr("Failed to parse Excel file: " + ex.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onFileChange = (e) => processFile(e.target.files[0]);
  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, []);
  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const { memberRows, teamSummary } = useMemo(() => {
    if (!data) return { memberRows: [], teamSummary: [] };
    const { loads, iterations, cap, teams } = data;

    const members = Object.keys(loads).sort();
    const memberRows = members.map((name) => {
      const iterLoads = loads[name];
      const iterCaps = cap[name] || {};
      const totalLoad = iterations.reduce((s, it) => s + (iterLoads[it] || 0), 0);
      const totalCap = iterations.reduce((s, it) => s + (iterCaps[it] || 0), 0);
      const util = totalCap > 0 ? Math.round((totalLoad / totalCap) * 100) : null;
      const team = teams[name] ? [...teams[name]].join("/") : "—";
      return { name, team, iterLoads, iterCaps, totalLoad, totalCap, util };
    });

    // Team summary
    const teamMap = {};
    for (const row of memberRows) {
      const teamNames = teams[row.name] ? [...teams[row.name]] : ["Unknown"];
      for (const t of teamNames) {
        if (!teamMap[t]) teamMap[t] = { load: 0, cap: 0, members: 0 };
        teamMap[t].load += row.totalLoad;
        teamMap[t].cap += row.totalCap;
        teamMap[t].members += 1;
      }
    }
    const teamSummary = Object.entries(teamMap).map(([name, d]) => ({
      name,
      load: Math.round(d.load * 10) / 10,
      cap: Math.round(d.cap * 10) / 10,
      util: d.cap > 0 ? Math.round((d.load / d.cap) * 100) : null,
      members: d.members,
    })).sort(([a], [b]) => a.localeCompare(b));

    return { memberRows, teamSummary };
  }, [data]);

  if (!data) {
    return (
      <div className="cap-upload-wrap">
        <div
          className={`cap-dropzone${dragging ? " dragging" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => document.getElementById("cap-file-input").click()}
        >
          <div className="cap-drop-icon">📊</div>
          <div className="cap-drop-title">Upload PI Capacity Excel</div>
          <div className="cap-drop-sub">Drag &amp; drop or click to select the capacity planning file</div>
          <div className="cap-drop-hint">Expected sheet: <code>2) IterationPlan</code></div>
          <input id="cap-file-input" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onFileChange} />
        </div>
        {err && <div className="cap-error">{err}</div>}
      </div>
    );
  }

  const { loads, iterations, cap } = data;

  return (
    <div className="cap-wrap">
      <div className="cap-file-bar">
        <span className="cap-file-name">📄 {fileName}</span>
        <button className="dash-btn" onClick={() => { setData(null); setFileName(""); }}>Change File</button>
      </div>

      {/* Team KPI tiles */}
      <div className="cap-team-row">
        {teamSummary.map((t) => {
          const col = UTIL_COLOR(t.util ?? 0);
          const color = TEAM_COLORS[t.name] || "#6c757d";
          return (
            <div key={t.name} className="cap-team-tile" style={{ borderTopColor: color }}>
              <div className="cap-team-name" style={{ color }}>{t.name}</div>
              <div className="cap-team-members">{t.members} member{t.members !== 1 ? "s" : ""}</div>
              <div className="cap-team-stats">
                <span>{t.load} / {t.cap > 0 ? t.cap : "—"} SP</span>
                {t.util !== null && (
                  <span className="cap-util-badge" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                    {t.util}%
                  </span>
                )}
              </div>
              {t.cap > 0 && (
                <div className="cap-util-bar-wrap">
                  <div className="cap-util-bar" style={{ width: `${Math.min(t.util, 100)}%`, background: col.border }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Per-person table */}
      <div className="cap-table-wrap">
        <table className="cap-table">
          <thead>
            <tr>
              <th>Member</th>
              <th>Team</th>
              {iterations.map((it) => (
                <th key={it} colSpan={2} className="cap-iter-header">{it}</th>
              ))}
              <th colSpan={2}>Total</th>
            </tr>
            <tr className="cap-subheader">
              <th /><th />
              {iterations.map((it) => [
                <th key={`${it}-l`} className="cap-sub-th">Load</th>,
                <th key={`${it}-c`} className="cap-sub-th">Cap</th>,
              ])}
              <th className="cap-sub-th">Load</th>
              <th className="cap-sub-th">Cap</th>
            </tr>
          </thead>
          <tbody>
            {memberRows.map((row) => {
              const col = UTIL_COLOR(row.util ?? 0);
              return (
                <tr key={row.name} className="cap-member-row">
                  <td className="cap-member-name">{row.name}</td>
                  <td className="cap-member-team">
                    <span className="cap-team-tag" style={{ background: TEAM_COLORS[row.team] ? TEAM_COLORS[row.team] + "22" : "#e9ecef", color: TEAM_COLORS[row.team] || "#495057", border: `1px solid ${TEAM_COLORS[row.team] || "#adb5bd"}` }}>
                      {row.team}
                    </span>
                  </td>
                  {iterations.map((it) => {
                    const load = row.iterLoads[it] || 0;
                    const c = (row.iterCaps[it]) || null;
                    const iterUtil = c ? Math.round((load / c) * 100) : null;
                    const ic = iterUtil !== null ? UTIL_COLOR(iterUtil) : null;
                    return [
                      <td key={`${it}-l`} className="cap-td-num">{load > 0 ? Math.round(load * 10) / 10 : "—"}</td>,
                      <td key={`${it}-c`} className="cap-td-num" style={ic ? { color: ic.text } : {}}>
                        {c !== null ? c : "—"}
                        {iterUtil !== null && <span className="cap-iter-pct" style={{ color: ic.text }}> {iterUtil}%</span>}
                      </td>,
                    ];
                  })}
                  <td className="cap-td-num cap-td-total">{Math.round(row.totalLoad * 10) / 10}</td>
                  <td className="cap-td-num cap-td-total">
                    {row.totalCap > 0 ? row.totalCap : "—"}
                    {row.util !== null && (
                      <span className="cap-util-badge cap-badge-sm" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                        {row.util}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="cap-legend">
        <span className="cap-leg-item" style={{ color: "#155724" }}>✅ &lt; 90% Healthy</span>
        <span className="cap-leg-item" style={{ color: "#7a5700" }}>⚠️ 90–100% Near Capacity</span>
        <span className="cap-leg-item" style={{ color: "#721c24" }}>🔴 &gt; 100% Over-allocated</span>
      </div>
    </div>
  );
}
