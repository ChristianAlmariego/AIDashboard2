import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

// Utilization thresholds
const UTIL_COLOR = (pct) => {
  if (pct === null) return { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
  if (pct > 100) return { bg: "#f8d7da", border: "#dc3545", text: "#721c24" };
  if (pct >= 90) return { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" };
  return { bg: "#d4edda", border: "#28a745", text: "#155724" };
};

// Sprint name → iteration key (e.g. "Sprint 1" → "PI27.1.1")
function sprintToIter(sprintLabel, piPrefix) {
  const m = sprintLabel.match(/(\d+)/);
  if (!m) return sprintLabel;
  return `${piPrefix}.${m[1]}`;
}

function parseFile(wb) {
  // ── 1. Find the "Weekly Capacity" sheet ──────────────────────────────────
  const capSheetName = wb.SheetNames.find((n) => /weekly.*cap|cap.*h/i.test(n));
  if (!capSheetName) throw new Error('Could not find "Weekly Capacity in H" sheet.');
  const capWs = wb.Sheets[capSheetName];
  const capRows = XLSX.utils.sheet_to_json(capWs, { header: 1, defval: null });

  // Row 5 (index 4) = sprint labels: null, "Sprint 1", null, null, "Sprint 2" …
  const sprintHeaderRow = capRows[4] ?? [];
  // Row 7 (index 6) = "Name", "Week 1" … "Week 12"
  const nameHeaderRow = capRows[6] ?? [];

  // Build sprint → [col indices] map (1-based col, index 0 = label col)
  const sprintCols = {}; // { "Sprint 1": [1,2,3], "Sprint 2": [4,5,6], … }
  let curSprint = null;
  for (let c = 1; c < sprintHeaderRow.length; c++) {
    if (sprintHeaderRow[c]) curSprint = String(sprintHeaderRow[c]);
    if (curSprint) {
      if (!sprintCols[curSprint]) sprintCols[curSprint] = [];
      sprintCols[curSprint].push(c);
    }
  }

  const sprints = Object.keys(sprintCols).sort(); // ["Sprint 1","Sprint 2","Sprint 3","Sprint 4"]

  // Detect PI prefix from IterationPlan
  const ipSheetName = wb.SheetNames.find((n) => /iteration.*plan|2\)/i.test(n));
  let piPrefix = "PI27.1";
  if (ipSheetName) {
    const ipWs = wb.Sheets[ipSheetName];
    const ipRows = XLSX.utils.sheet_to_json(ipWs, { header: 1, defval: null });
    for (const row of ipRows) {
      const iter = String(row[3] ?? "");
      const m = iter.match(/(PI\d+\.\d+)\.\d+/i);
      if (m) { piPrefix = m[1]; break; }
    }
  }

  // Map sprint label → iteration key
  const sprintToIterMap = {};
  for (const s of sprints) {
    sprintToIterMap[s] = sprintToIter(s, piPrefix);
  }
  const iterations = sprints.map((s) => sprintToIterMap[s]); // ["PI27.1.1", …]

  // ── 2. Parse capacity rows (rows 26–35, index ~25–34) ──────────────────
  // Find the "Weekly Capacity" section header row
  let capDataStart = -1;
  for (let i = 0; i < capRows.length; i++) {
    const cell = String(capRows[i]?.[0] ?? "");
    if (/weekly capacity/i.test(cell) && i > 15) { capDataStart = i + 2; break; } // skip header + dates row
  }
  if (capDataStart === -1) capDataStart = 24; // fallback

  const capacity = {}; // { name: { iterKey: hours } }
  for (let i = capDataStart; i < capRows.length; i++) {
    const row = capRows[i];
    const name = String(row?.[0] ?? "").trim();
    if (!name || /total|name/i.test(name)) continue;
    if (!row || row.slice(1).every((v) => v === null)) break;
    capacity[name] = {};
    for (const [sprint, cols] of Object.entries(sprintCols)) {
      const iterKey = sprintToIterMap[sprint];
      capacity[name][iterKey] = cols.reduce((s, c) => s + (typeof row[c] === "number" ? row[c] : 0), 0);
    }
  }

  // ── 3. Parse load from IterationPlan ────────────────────────────────────
  // Col A=work item, B=category, C=priority, D=iteration, E=assignee, F=hours
  const load = {}; // { name: { iterKey: hours } }
  const categories = {}; // { name: Set<category> }

  if (ipSheetName) {
    const ipWs = wb.Sheets[ipSheetName];
    const ipRows = XLSX.utils.sheet_to_json(ipWs, { header: 1, defval: null });
    for (const row of ipRows) {
      const assignee = String(row[4] ?? "").trim();
      const iteration = String(row[3] ?? "").trim();
      const hours = row[5];
      const category = String(row[1] ?? "").trim();
      if (!assignee || !iteration || typeof hours !== "number") continue;
      if (!load[assignee]) load[assignee] = {};
      load[assignee][iteration] = (load[assignee][iteration] || 0) + hours;
      if (category) {
        if (!categories[assignee]) categories[assignee] = new Set();
        categories[assignee].add(category);
      }
    }
  }

  return { capacity, load, iterations, categories, piPrefix };
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
        const parsed = parseFile(wb);
        setData(parsed);
        setFileName(file.name);
      } catch (ex) {
        setErr("Failed to parse file: " + ex.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const onFileChange = (e) => processFile(e.target.files[0]);
  const onDrop = useCallback((e) => {
    e.preventDefault(); setDragging(false);
    processFile(e.dataTransfer.files[0]);
  }, []);

  const memberRows = useMemo(() => {
    if (!data) return [];
    const { capacity, load, iterations } = data;
    const names = [...new Set([...Object.keys(capacity), ...Object.keys(load)])].sort();

    return names.map((name) => {
      const cap = capacity[name] || {};
      const ld = load[name] || {};
      const iterData = iterations.map((it) => {
        const c = cap[it] ?? null;
        const l = ld[it] ?? 0;
        const util = c ? Math.round((l / c) * 100) : null;
        return { iter: it, cap: c, load: l, util };
      });
      const totalCap = iterData.reduce((s, d) => s + (d.cap ?? 0), 0);
      const totalLoad = iterData.reduce((s, d) => s + d.load, 0);
      const totalUtil = totalCap > 0 ? Math.round((totalLoad / totalCap) * 100) : null;
      return { name, iterData, totalCap, totalLoad, totalUtil };
    });
  }, [data]);

  if (!data) {
    return (
      <div className="cap-upload-wrap">
        <div
          className={`cap-dropzone${dragging ? " dragging" : ""}`}
          onDrop={onDrop}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onClick={() => document.getElementById("cap-file-input").click()}
        >
          <div className="cap-drop-icon">📊</div>
          <div className="cap-drop-title">Upload PI Capacity Excel</div>
          <div className="cap-drop-sub">Drag &amp; drop or click to select the capacity planning file</div>
          <div className="cap-drop-hint">Reads <code>Weekly Capacity in H</code> + <code>2) IterationPlan</code> sheets</div>
          <input id="cap-file-input" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={onFileChange} />
        </div>
        {err && <div className="cap-error">{err}</div>}
      </div>
    );
  }

  const { iterations, piPrefix } = data;

  // Overall team summary per iteration
  const teamSummary = iterations.map((it) => {
    const totalCap = memberRows.reduce((s, r) => s + (r.iterData.find((d) => d.iter === it)?.cap ?? 0), 0);
    const totalLoad = memberRows.reduce((s, r) => s + (r.iterData.find((d) => d.iter === it)?.load ?? 0), 0);
    const util = totalCap > 0 ? Math.round((totalLoad / totalCap) * 100) : null;
    return { it, totalCap, totalLoad, util };
  });

  const grandCap = memberRows.reduce((s, r) => s + r.totalCap, 0);
  const grandLoad = memberRows.reduce((s, r) => s + r.totalLoad, 0);
  const grandUtil = grandCap > 0 ? Math.round((grandLoad / grandCap) * 100) : null;

  return (
    <div className="cap-wrap">
      <div className="cap-file-bar">
        <span className="cap-file-name">📄 {fileName}</span>
        <button className="dash-btn" onClick={() => { setData(null); setFileName(""); }}>Change File</button>
      </div>

      {/* Team KPI tiles per iteration */}
      <div className="cap-team-row">
        <div className="cap-team-tile" style={{ borderTopColor: "#003865" }}>
          <div className="cap-team-name" style={{ color: "#003865" }}>{piPrefix} Total</div>
          <div className="cap-team-members">{memberRows.length} members</div>
          <div className="cap-team-stats">
            <span>{grandLoad}h / {grandCap}h</span>
            {grandUtil !== null && (
              <span className="cap-util-badge" style={{ background: UTIL_COLOR(grandUtil).bg, color: UTIL_COLOR(grandUtil).text, border: `1px solid ${UTIL_COLOR(grandUtil).border}` }}>
                {grandUtil}%
              </span>
            )}
          </div>
          {grandCap > 0 && (
            <div className="cap-util-bar-wrap">
              <div className="cap-util-bar" style={{ width: `${Math.min(grandUtil, 100)}%`, background: UTIL_COLOR(grandUtil).border }} />
            </div>
          )}
        </div>
        {teamSummary.map(({ it, totalCap, totalLoad, util }) => {
          const col = UTIL_COLOR(util);
          return (
            <div key={it} className="cap-team-tile" style={{ borderTopColor: col.border }}>
              <div className="cap-team-name" style={{ color: col.text }}>{it}</div>
              <div className="cap-team-members">Sprint capacity</div>
              <div className="cap-team-stats">
                <span>{totalLoad}h / {totalCap}h</span>
                {util !== null && (
                  <span className="cap-util-badge" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                    {util}%
                  </span>
                )}
              </div>
              {totalCap > 0 && (
                <div className="cap-util-bar-wrap">
                  <div className="cap-util-bar" style={{ width: `${Math.min(util, 100)}%`, background: col.border }} />
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
              {iterations.map((it) => (
                <th key={it} colSpan={3} className="cap-iter-header">{it}</th>
              ))}
              <th colSpan={3} className="cap-iter-header">Total</th>
            </tr>
            <tr className="cap-subheader">
              <th />
              {[...iterations, "total"].map((it) => [
                <th key={`${it}-l`} className="cap-sub-th">Load (h)</th>,
                <th key={`${it}-c`} className="cap-sub-th">Cap (h)</th>,
                <th key={`${it}-u`} className="cap-sub-th">Util %</th>,
              ])}
            </tr>
          </thead>
          <tbody>
            {memberRows.map((row) => {
              const totalCol = UTIL_COLOR(row.totalUtil);
              return (
                <tr key={row.name} className="cap-member-row">
                  <td className="cap-member-name">{row.name}</td>
                  {row.iterData.map(({ iter, cap, load, util }) => {
                    const col = UTIL_COLOR(util);
                    return [
                      <td key={`${iter}-l`} className="cap-td-num">{load > 0 ? load : "—"}</td>,
                      <td key={`${iter}-c`} className="cap-td-num">{cap !== null ? cap : "—"}</td>,
                      <td key={`${iter}-u`} className="cap-td-num">
                        {util !== null ? (
                          <span className="cap-util-badge cap-badge-sm" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                            {util}%
                          </span>
                        ) : "—"}
                      </td>,
                    ];
                  })}
                  <td className="cap-td-num cap-td-total">{row.totalLoad > 0 ? row.totalLoad : "—"}</td>
                  <td className="cap-td-num cap-td-total">{row.totalCap > 0 ? row.totalCap : "—"}</td>
                  <td className="cap-td-num cap-td-total">
                    {row.totalUtil !== null ? (
                      <span className="cap-util-badge cap-badge-sm" style={{ background: totalCol.bg, color: totalCol.text, border: `1px solid ${totalCol.border}` }}>
                        {row.totalUtil}%
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="cap-member-row" style={{ fontWeight: 700, background: "#f1f3f5" }}>
              <td className="cap-member-name">TOTAL</td>
              {teamSummary.map(({ it, totalLoad, totalCap, util }) => {
                const col = UTIL_COLOR(util);
                return [
                  <td key={`${it}-l`} className="cap-td-num cap-td-total">{totalLoad}</td>,
                  <td key={`${it}-c`} className="cap-td-num cap-td-total">{totalCap}</td>,
                  <td key={`${it}-u`} className="cap-td-num cap-td-total">
                    {util !== null && (
                      <span className="cap-util-badge cap-badge-sm" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>
                        {util}%
                      </span>
                    )}
                  </td>,
                ];
              })}
              <td className="cap-td-num cap-td-total">{grandLoad}</td>
              <td className="cap-td-num cap-td-total">{grandCap}</td>
              <td className="cap-td-num cap-td-total">
                {grandUtil !== null && (
                  <span className="cap-util-badge cap-badge-sm" style={{ background: UTIL_COLOR(grandUtil).bg, color: UTIL_COLOR(grandUtil).text, border: `1px solid ${UTIL_COLOR(grandUtil).border}` }}>
                    {grandUtil}%
                  </span>
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="cap-legend">
        <span className="cap-leg-item" style={{ color: "#155724" }}>✅ &lt; 90% Healthy</span>
        <span className="cap-leg-item" style={{ color: "#7a5700" }}>⚠️ 90–100% Near Capacity</span>
        <span className="cap-leg-item" style={{ color: "#721c24" }}>🔴 &gt; 100% Over-allocated</span>
        <span className="cap-leg-item" style={{ color: "#666", marginLeft: "auto" }}>Load & Capacity in hours (h)</span>
      </div>
    </div>
  );
}
