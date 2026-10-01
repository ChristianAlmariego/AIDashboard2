import { PublicClientApplication, InteractionRequiredAuthError } from "@azure/msal-browser";

// ─── Azure AD App Registration ────────────────────────────────────────────────
// Register a Single-Page Application at https://portal.azure.com:
//   - Redirect URI: https://christianalmariego.github.io/AIDashboard2/
//   - API permissions: Microsoft Graph → Sites.Read.All (delegated)
// Then paste the Application (client) ID below.
const CLIENT_ID = "YOUR_CLIENT_ID_HERE";

const TENANT_ID = "common"; // or your Emerson tenant ID for faster login

const SHAREPOINT_HOST = "emerson.sharepoint.com";
const SITE_PATH = "/sites/DCXIT";
const LIBRARY_NAME = "QA Library";
const FOLDER_SERVER_PATH = "/sites/DCXIT/QA Library/General/FY26 Documents/PI Planning Documents";
// Graph folder path (relative to drive root)
const GRAPH_FOLDER_PATH = "General/FY26 Documents/PI Planning Documents";

// ─── MSAL instance ────────────────────────────────────────────────────────────
let _pca = null;

function getPca() {
  if (!_pca) {
    _pca = new PublicClientApplication({
      auth: {
        clientId: CLIENT_ID,
        authority: `https://login.microsoftonline.com/${TENANT_ID}`,
        redirectUri: window.location.origin + window.location.pathname,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
  }
  return _pca;
}

async function getToken() {
  const pca = getPca();
  await pca.initialize();

  // Handle redirect response if returning from login
  await pca.handleRedirectPromise();

  const accounts = pca.getAllAccounts();
  const scopes = [`https://${SHAREPOINT_HOST}/.default`];

  const request = { scopes, account: accounts[0] };

  try {
    const result = await pca.acquireTokenSilent(request);
    return result.accessToken;
  } catch (e) {
    if (e instanceof InteractionRequiredAuthError || !accounts.length) {
      // Popup is more SPA-friendly than redirect for this use case
      const result = await pca.acquireTokenPopup({ scopes });
      return result.accessToken;
    }
    throw e;
  }
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
  return CLIENT_ID !== "YOUR_CLIENT_ID_HERE";
}

/** Sign in and return the user's display name */
export async function signIn() {
  const token = await getToken();
  const me = await graphGet(token, "/me");
  return me.displayName ?? me.userPrincipalName;
}

/** Sign out */
export async function signOut() {
  const pca = getPca();
  await pca.initialize();
  const accounts = pca.getAllAccounts();
  if (accounts.length) await pca.logoutPopup({ account: accounts[0] });
  _siteId = null;
  _driveId = null;
}

/** List PI folder names under the base planning folder.
 *  Returns [{ name: "PI 27.1", id: "..." }, …] */
export async function listPiFolders() {
  const token = await getToken();
  const { siteId, driveId } = await resolveSiteDrive(token);

  const data = await graphGet(
    token,
    `/sites/${siteId}/drives/${driveId}/root:/${encodeURIComponent(GRAPH_FOLDER_PATH)}:/children?$filter=folder ne null&$select=id,name,folder`
  );

  return (data.value ?? [])
    .filter((item) => item.folder && /PI\s*\d+\.\d+/i.test(item.name))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))
    .map((item) => ({ id: item.id, name: item.name }));
}

/** Find and download the capacity Excel file inside a PI folder.
 *  Returns ArrayBuffer ready for XLSX.read(). */
export async function downloadPiExcel(piFolderId) {
  const token = await getToken();
  const { siteId, driveId } = await resolveSiteDrive(token);

  // List children of the PI folder
  const data = await graphGet(
    token,
    `/sites/${siteId}/drives/${driveId}/items/${piFolderId}/children?$select=id,name,file`
  );

  const file = (data.value ?? []).find(
    (item) => item.file && /capacity.*planning.*template.*\.xlsx?$/i.test(item.name)
  );
  if (!file) throw new Error("Capacity Planning Template Excel not found in the selected PI folder.");

  // Download file content
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/sites/${siteId}/drives/${driveId}/items/${file.id}/content`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

  return { buffer: await res.arrayBuffer(), fileName: file.name };
}
