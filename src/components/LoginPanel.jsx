import { useState } from "react";

export default function LoginPanel({ onConnect, loading, error }) {
  const [pat, setPat] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (pat.trim()) onConnect(pat.trim());
  }

  return (
    <div className="login-overlay">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <rect width="40" height="40" rx="8" fill="#0078d4" />
              <path d="M8 28L16 12L24 22L30 16L34 28H8Z" fill="white" opacity="0.9" />
            </svg>
          </div>
          <h1>ADO Dashboard</h1>
          <p className="login-subtitle">Emerson Quality Assurance Team</p>
          <p className="login-org">EMR-DigMod · EMR DCX IT</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label htmlFor="pat">Azure DevOps Personal Access Token</label>
          <div className="pat-hint">
            Requires <strong>Work Items (Read)</strong> scope.{" "}
            <a
              href="https://learn.microsoft.com/en-us/azure/devops/organizations/accounts/use-personal-access-tokens-to-authenticate"
              target="_blank"
              rel="noreferrer"
            >
              How to create a PAT →
            </a>
          </div>
          <input
            id="pat"
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            placeholder="Paste your PAT here"
            autoComplete="off"
            required
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading || !pat.trim()} className="btn-primary">
            {loading ? "Connecting…" : "Connect to ADO"}
          </button>
        </form>

        <p className="login-note">
          Your token is never stored. It is used only for this session to query the ADO REST API.
        </p>
      </div>
    </div>
  );
}
