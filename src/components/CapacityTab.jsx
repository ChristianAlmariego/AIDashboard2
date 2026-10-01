import { useState, useCallback, useMemo, useEffect } from "react";
import * as XLSX from "xlsx";
import { isConfigured, signIn, signOut, listPiFolders, downloadPiExcel } from "../api/sharepoint";

// Utilization thresholds
const UTIL_COLOR = (pct) => {
  if (pct === null) return { bg: "#e9ecef", border: "#adb5bd", text: "#495057" };
  if (pct > 100) return { bg: "#f8d7da", border: "#dc3545", text: "#721c24" };
  if (pct >= 90) return { bg: "#fff3cd", border: "#f0c040", text: "#7a5700" };
  return { bg: "#d4edda", border: "#28a745", text: "#155724" };
};

function parseWorkbook(wb) {
  // Find the "1) TeamLogistics" sheet
  const tlSheetName = wb.SheetNames.find((n) => /team.*logistics|1\)/i.test(n));
  if (!tlSheetName) throw new Error('Could not find "1) TeamLogistics" sheet.');
  const tlWs = wb.Sheets[tlSheetName];
  const tlRows = XLSX.utils.sheet_to_json(tlWs, { header: 1, defval: null });

  // Find the "Capacity in H" section header row
  let sectionRow = -1;
  for (let i = 0; i < tlRows.length; i++) {
    const cell = String(tlRows[i]?.[0] ?? "");
    if (/capacity in h/i.test(cell)) { sectionRow = i; break; }
  }
  if (sectionRow === -1) throw new Error('Could not find "Capacity in H" section in TeamLogistics sheet.');

  // Next row: column headers — Name, ..., PI27.1.1, PI27.1.2, PI27.1.3, PI27.1.4, TOTAL, ...
  const headerRow = tlRows[sectionRow + 1] ?? [];

  const iterations = [];
  const capCols = [];
  const loadCols = [];

  for (let c = 0; c < headerRow.length; c++) {
    const h = String(headerRow[c] ?? "").trim();
    if (/PI\d+\.\d+\.\d+/i.test(h)) {
      if (capCols.length < 4) {
        capCols.push(c);
        if (!iterations.includes(h)) iterations.push(h);
      } else if (loadCols.length < 4) {
        loadCols.push(c);
      }
    }
  }

  if (capCols.length === 0) throw new Error("Could not find sprint iteration columns in TeamLogistics sheet.");
  if (loadCols.length === 0) loadCols.push(...capCols.map((c) => c + 8));

  const piPrefix = iterations[0]?.match(/(PI\d+\.\d+)\.\d+/i)?.[1] ?? "PI";

  const capacity = {};
  const load = {};

  const dataStart = sectionRow + 2;
  for (let i = dataStart; i < tlRows.length; i++) {
    const row = tlRows[i];
    const name = String(row?.[0] ?? "").trim();
    if (!name || /^total$/i.test(name)) {
      if (/^total$/i.test(name)) break;
      continue;
    }
    if (!row || row.slice(1).every((v) => v === null)) break;

    capacity[name] = {};
    load[name] = {};

    for (let s = 0; s < iterations.length; s++) {
      const iter = iterations[s];
      const capVal = row[capCols[s]];
      const loadVal = row[loadCols[s]];
      capacity[name][iter] = typeof capVal === "number" ? capVal : 0;
      load[name][iter] = typeof loadVal === "number" ? loadVal : 0;
    }
  }

  return { capacity, load, iterations, piPrefix };
}

// ─── SharePoint Picker ────────────────────────────────────────────────────────
function SharePointPicker({ onLoaded }) {
  const [step, setStep] = useState("idle"); // idle | signing-in | picking | loading
  const [user, setUser] = useState(null);
  const [folders, setFolders] = useState([]);
  const [selectedFolderId, setSelectedFolderId] = useState("");
  const [err, setErr] = useState("");

  const configured = isConfigured();

  async function handleSignIn() {
    setErr("");
    setStep("signing-in");
    try {
      const name = await signIn();
      setUser(name);
      setStep("picking");
      const piFolders = await listPiFolders();
      setFolders(piFolders);
      if (piFolders.length) setSelectedFolderId(piFolders[piFolders.length - 1].id);
    } catch (e) {
      setErr(e.message);
      setStep("idle");
    }
  }

  async function handleLoad() {
    if (!selectedFolderId) return;
    setErr("");
    setStep("loading");
    try {
      const { buffer, fileName } = await downloadPiExcel(selectedFolderId);
      const wb = XLSX.read(buffer, { type: "array" });
      const parsed = parseWorkbook(wb);
      onLoaded(parsed, fileName);
    } catch (e) {
      setErr(e.message);
      setStep("picking");
    }
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
    setFolders([]);
    setSelectedFolderId("");
    setStep("idle");
  }

  if (!configured) {
    return (
      <div className="cap-upload-wrap">
        <div className="cap-dropzone" style={{ cursor: "default", borderStyle: "solid" }}>
          <div className="cap-drop-icon">⚙️</div>
          <div className="cap-drop-title">SharePoint Integration — Setup Required</div>
          <div className="cap-drop-sub" style={{ maxWidth: 480 }}>
            Register an Azure AD Single-Page Application and paste its <strong>Client ID</strong> into{" "}
            <code>src/api/sharepoint.js</code> (the <code>CLIENT_ID</code> constant).
          </div>
          <div className="cap-drop-hint" style={{ marginTop: 12 }}>
            Redirect URI to register: <code>{window.location.origin + window.location.pathname}</code>
            <br />
            Required Graph permission: <code>Sites.Read.All</code> (delegated)
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="cap-upload-wrap">
      <div className="cap-sp-card">
        <div className="cap-sp-logo">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect width="32" height="32" rx="6" fill="#038387" />
            <text x="6" y="23" fontSize="20" fontWeight="bold" fill="white">S</text>
          </svg>
          <span className="cap-sp-title">Emerson SharePoint — QA Library</span>
        </div>

        <div className="cap-sp-path">
          General / FY26 Documents / PI Planning Documents
        </div>

        {!user && (
          <button
            className="dash-btn cap-sp-btn"
            onClick={handleSignIn}
            disabled={step === "signing-in"}
          >
            {step === "signing-in" ? "Signing in…" : "Sign in with Microsoft"}
          </button>
        )}

        {user && (
          <>
            <div className="cap-sp-user">
              Signed in as <strong>{user}</strong>
              <button className="cap-sp-signout" onClick={handleSignOut}>Sign out</button>
            </div>

            {folders.length === 0 && step === "picking" && (
              <div className="cap-sp-hint">No PI folders found in the planning folder.</div>
            )}

            {folders.length > 0 && (
              <div className="cap-sp-row">
                <label className="cap-sp-label">Select PI</label>
                <select
                  className="dash-select cap-sp-select"
                  value={selectedFolderId}
                  onChange={(e) => setSelectedFolderId(e.target.value)}
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
                <button
                  className="dash-btn cap-sp-btn"
                  onClick={handleLoad}
                  disabled={step === "loading" || !selectedFolderId}
                >
                  {step === "loading" ? "Loading…" : "Load Capacity"}
                </button>
              </div>
            )}
          </>
        )}

        {err && <div className="cap-error" style={{ marginTop: 12 }}>{err}</div>}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CapacityTab() {
  const [data, setData] = useState(null);
  const [fileName, setFileName] = useState("");

  function handleLoaded(parsed, name) {
    setData(parsed);
    setFileName(name);
  }

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
    return <SharePointPicker onLoaded={handleLoaded} />;
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
        <button className="dash-btn" onClick={() => { setData(null); setFileName(""); }}>Change PI</button>
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
