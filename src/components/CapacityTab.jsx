import { useState, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";

const UTIL_COLOR = (pct) => {
  if (pct === null) return { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
  if (pct > 100) return { bg: "#f8d7da", border: "#dc3545", text: "#721c24" };
  if (pct >= 90) return { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" };
  return { bg: "#d4edda", border: "#28a745", text: "#155724" };
};

function parseWorkbook(wb) {
  const tlSheetName = wb.SheetNames.find((n) => /team.*logistics|1\)/i.test(n));
  if (!tlSheetName) throw new Error('Could not find "1) TeamLogistics" sheet.');
  const tlWs = wb.Sheets[tlSheetName];
  const tlRows = XLSX.utils.sheet_to_json(tlWs, { header: 1, defval: null });

  let sectionRow = -1;
  for (let i = 0; i < tlRows.length; i++) {
    if (/capacity in h/i.test(String(tlRows[i]?.[0] ?? ""))) { sectionRow = i; break; }
  }
  if (sectionRow === -1) throw new Error('Could not find "Capacity in H" section in TeamLogistics sheet.');

  const headerRow = tlRows[sectionRow + 1] ?? [];
  const iterations = [];
  const capCols = [];
  const loadCols = [];

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim();
    if (/PI\d+\.\d+\.\d+/i.test(h)) {
      if (capCols.length < 4) { capCols.push(c); iterations.push(h); }
      else if (loadCols.length < 4) { loadCols.push(c); }
    }
  }

  if (capCols.length === 0) throw new Error("Could not find sprint iteration columns in TeamLogistics sheet.");
  if (loadCols.length === 0) loadCols.push(...capCols.map((c) => c + 8));

  const piPrefix = iterations[0]?.match(/(PI\d+\.\d+)\.\d+/i)?.[1] ?? "PI";
  const capacity = {};
  const load = {};

  for (let i = sectionRow + 2; i < tlRows.length; i++) {
    const row = tlRows[i];
    const name = String(row?.[0] ?? "").trim();
    if (!name) continue;
    if (/^total$/i.test(name)) break;
    if (!row || row.slice(1).every((v) => v === null)) break;
    capacity[name] = {};
    load[name] = {};
    for (let s = 0; s < iterations.length; s++) {
      const iter = iterations[s];
      capacity[name][iter] = typeof row[capCols[s]] === "number" ? row[capCols[s]] : 0;
      load[name][iter] = typeof row[loadCols[s]] === "number" ? row[loadCols[s]] : 0;
    }
  }

  return { capacity, load, iterations, piPrefix };
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
        setData(parseWorkbook(wb));
        setFileName(file.name);
      } catch (ex) {
        setErr("Failed to parse file: " + ex.message);
      }
    };
    reader.readAsArrayBuffer(file);
  }

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
          <div className="cap-drop-hint">Reads the <code>1) TeamLogistics</code> sheet for capacity &amp; load</div>
          <input id="cap-file-input" type="file" accept=".xlsx,.xls" style={{ display: "none" }} onChange={(e) => processFile(e.target.files[0])} />
        </div>
        {err && <div className="cap-error">{err}</div>}
      </div>
    );
  }

  const { iterations, piPrefix } = data;

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

      <div className="cap-table-wrap">
        <table className="cap-table">
          <thead>
            <tr>
              <th>Member</th>
              {iterations.map((it) => <th key={it} colSpan={3} className="cap-iter-header">{it}</th>)}
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
                        {util !== null ? <span className="cap-util-badge cap-badge-sm" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>{util}%</span> : "—"}
                      </td>,
                    ];
                  })}
                  <td className="cap-td-num cap-td-total">{row.totalLoad > 0 ? row.totalLoad : "—"}</td>
                  <td className="cap-td-num cap-td-total">{row.totalCap > 0 ? row.totalCap : "—"}</td>
                  <td className="cap-td-num cap-td-total">
                    {row.totalUtil !== null ? <span className="cap-util-badge cap-badge-sm" style={{ background: totalCol.bg, color: totalCol.text, border: `1px solid ${totalCol.border}` }}>{row.totalUtil}%</span> : "—"}
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
                    {util !== null && <span className="cap-util-badge cap-badge-sm" style={{ background: col.bg, color: col.text, border: `1px solid ${col.border}` }}>{util}%</span>}
                  </td>,
                ];
              })}
              <td className="cap-td-num cap-td-total">{grandLoad}</td>
              <td className="cap-td-num cap-td-total">{grandCap}</td>
              <td className="cap-td-num cap-td-total">
                {grandUtil !== null && <span className="cap-util-badge cap-badge-sm" style={{ background: UTIL_COLOR(grandUtil).bg, color: UTIL_COLOR(grandUtil).text, border: `1px solid ${UTIL_COLOR(grandUtil).border}` }}>{grandUtil}%</span>}
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
