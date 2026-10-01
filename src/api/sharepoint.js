import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";

// ─── Client ID — stored in localStorage, set via UI ──────────────────────────
const LS_CLIENT = "aidashboard_sp_client_id";
const LS_TENANT = "aidashboard_sp_tenant_id";

export function getClientId() {
  try { return localStorage.getItem(LS_CLIENT) ?? ""; } catch { return ""; }
}
export function getTenantId() {
  try { return localStorage.getItem(LS_TENANT) ?? ""; } catch { return ""; }
}

export function setCredentials(clientId, tenantId) {
  try {
    localStorage.setItem(LS_CLIENT, clientId.trim());
    localStorage.setItem(LS_TENANT, tenantId.trim());
  } catch {}
  _pca = null;
}
const SHAREPOINT_HOST = "emerson.sharepoint.com";
const SITE_PATH = "/sites/DCXIT";
const LIBRARY_NAME = "QA Library";
const GRAPH_FOLDER_PATH = "General/FY26 Documents/PI Planning Documents";

// ─── MSAL instance ────────────────────────────────────────────────────────────
let _pca = null;
let _initialized = false;

function getRedirectUri() {
  // Must match exactly what's registered in Azure AD
  return window.location.origin + window.location.pathname.replace(/\/$/, "");
}

async function getPca() {
  if (!_pca) {
    _pca = new PublicClientApplication({
      auth: {
        clientId: getClientId(),
        authority: `https://login.microsoftonline.com/${getTenantId()}`,
        redirectUri: getRedirectUri(),
        navigateToLoginRequestUrl: true,
      },
      cache: {
        cacheLocation: "sessionStorage",
        storeAuthStateInCookie: true, // helps with browsers blocking third-party cookies
      },
    });
    _initialized = false;
  }
  if (!_initialized) {
    await _pca.initialize();
    _initialized = true;
  }
  return _pca;
}

// Call this on app load to complete any pending redirect login
export async function handleRedirect() {
  try {
    const pca = await getPca();
    const result = await pca.handleRedirectPromise();
    return result; // non-null if returning from a redirect login
  } catch {
    return null;
  }
}

const SCOPES = ["Sites.Read.All", "Files.Read.All", "User.Read"];

async function getToken() {
  const pca = await getPca();
  const accounts = pca.getAllAccounts();

  if (accounts.length) {
    try {
      const result = await pca.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
      return result.accessToken;
    } catch (e) {
      if (!(e instanceof InteractionRequiredAuthError)) throw e;
      // Fall through to redirect login
    }
  }

  // Use redirect (no popup — avoids popup-blocked / timed_out errors)
  await pca.loginRedirect({ scopes: SCOPES });
  // loginRedirect navigates away; execution stops here
  return null; // unreachable, satisfies linter
}

async function graphGet(token, path) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`Graph API error ${res.status}: ${err}`);
  }
  return res.json();
}

// ─── Resolve site + drive IDs (cached per session) ───────────────────────────
let _siteId = null;
let _driveId = null;

async function resolveSiteDrive(token) {
  if (_siteId && _driveId) return { siteId: _siteId, driveId: _driveId };

  const site = await graphGet(token, `/sites/${SHAREPOINT_HOST}:${SITE_PATH}`);
  _siteId = site.id;

  const drives = await graphGet(token, `/sites/${_siteId}/drives`);
  const drive = drives.value.find((d) => d.name === LIBRARY_NAME);
  if (!drive) throw new Error(`Document library "${LIBRARY_NAME}" not found in site.`);
  _driveId = drive.id;

  return { siteId: _siteId, driveId: _driveId };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function isConfigured() {
  return getClientId().length > 0 && getTenantId().length > 0;
}

export function getSignedInAccount() {
  if (!_pca || !_initialized) return null;
  const accounts = _pca.getAllAccounts();
  return accounts[0] ?? null;
}

/** Trigger redirect login (navigates away then back) */
export async function signIn() {
  await getToken(); // triggers loginRedirect if not signed in
}

/** Fetch user display name after redirect returns */
export async function getMe() {
  const pca = await getPca();
  const accounts = pca.getAllAccounts();
  if (!accounts.length) return null;
  const result = await pca.acquireTokenSilent({ scopes: SCOPES, account: accounts[0] });
  const me = await graphGet(result.accessToken, "/me");
  return me.displayName ?? me.userPrincipalName;
}

/** Sign out via redirect */
export async function signOut() {
  const pca = await getPca();
  const accounts = pca.getAllAccounts();
  _siteId = null;
  _driveId = null;
  if (accounts.length) {
    await pca.logoutRedirect({ account: accounts[0] });
  }
}

/** List PI folder names. Returns [{ name, id }] */
export async function listPiFolders() {
  const token = await getToken();
  const { siteId, driveId } = await resolveSiteDrive(token);

  const encoded = GRAPH_FOLDER_PATH.split("/").map(encodeURIComponent).join("/");
  const data = await graphGet(
    token,
    `/sites/${siteId}/drives/${driveId}/root:/${encoded}:/children?$select=id,name,folder`
  );

  return (data.value ?? [])
    .filter((item) => item.folder && /PI\s*\d+\.\d+/i.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((item) => ({ id: item.id, name: item.name }));
}

/** Download the capacity Excel inside a PI folder. Returns { buffer, fileName } */
export async function downloadPiExcel(piFolderId) {
  const token = await getToken();
  const { siteId, driveId } = await resolveSiteDrive(token);

  const data = await graphGet(
    token,
    `/sites/${siteId}/drives/${driveId}/items/${piFolderId}/children?$select=id,name,file`
  );

  const file = (data.value ?? []).find(
    (item) => item.file && /capacity.*planning.*template.*\.xlsx?$/i.test(item.name)
  );
  if (!file) throw new Error("Capacity Planning Template Excel not found in the selected PI folder.");

  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${file.id}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

  return { buffer: await res.arrayBuffer(), fileName: file.name };
}
