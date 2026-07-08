import { useRef, useState } from "react";

export default function UploadPanel({ onData, error }) {
  const inputRef = useRef();
  const [dragging, setDragging] = useState(false);

  function handleFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => onData(e.target.result, file.name);
    reader.readAsText(file);
  }

  function handleChange(e) {
    handleFile(e.target.files[0]);
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <div className="logo-mark-upload">QA</div>
          </div>
          <h1>QA Team Daily Dashboard</h1>
          <p className="login-subtitle">Emerson Digital Modernization · PI 26.4 · Sprint 26.4.1</p>
        </div>

        <div
          className={`drop-zone${dragging ? " drag-over" : ""}`}
          onClick={() => inputRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
        >
          <div className="drop-icon">📂</div>
          <div className="drop-primary">Drop your ADO CSV export here</div>
          <div className="drop-secondary">or click to browse · accepts .csv files</div>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          style={{ display: "none" }}
          onChange={handleChange}
        />

        {error && <div className="login-error">{error}</div>}

        <p className="login-note">
          Export from Azure DevOps · Query results · All columns including Work Item Type,
          Title 1, Title 2, Priority, State, Assigned To, Iteration Path.
          File is parsed locally — never uploaded.
        </p>
      </div>
    </div>
  );
}
