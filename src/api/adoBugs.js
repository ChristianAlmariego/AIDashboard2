const ORG = "EmersonAutomationSolutions";
const PROJECT = "EMR-DigMod";
const BASE_URL = `https://dev.azure.com/${ORG}/${PROJECT}/_apis`;

const BUG_FIELDS = [
  "System.Id",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.WorkItemType",
  "System.IterationPath",
  "System.AreaPath",
  "Microsoft.VSTS.Common.Priority",
  "Microsoft.VSTS.Common.Severity",
  "System.Tags",
  "System.ChangedDate",
].join(",");

const STORY_FIELDS = [
  "System.Id",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.WorkItemType",
  "System.IterationPath",
  "System.AreaPath",
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "Microsoft.VSTS.Common.Priority",
  "System.Tags",
].join(",");

const FEATURE_FIELDS = [
  "System.Id",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.WorkItemType",
  "System.IterationPath",
  "System.AreaPath",
  "Microsoft.VSTS.Common.Priority",
  "System.Tags",
].join(",");

function makeHeaders(pat) {
  return {
    Authorization: `Basic ${btoa(`:${pat}`)}`,
    "Content-Type": "application/json",
  };
}

export function parseFeatureId(input) {
  const str = input.trim();
  // Plain number
  if (/^\d+$/.test(str)) return parseInt(str, 10);
  // URL: /edit/12345 or ?workitem=12345
  const m = str.match(/\/edit\/(\d+)|[?&]workitem=(\d+)/);
  if (m) return parseInt(m[1] || m[2], 10);
  return null;
}

async function fetchSingle(pat, id, fields) {
  const res = await fetch(
    `${BASE_URL}/wit/workitems/${id}?fields=${fields}&api-version=7.0`,
    { headers: makeHeaders(pat) }
  );
  if (!res.ok) throw new Error(`ADO error ${res.status} fetching item ${id}`);
  return res.json();
}

async function fetchSingleRelations(pat, id) {
  const res = await fetch(
    `${BASE_URL}/wit/workitems/${id}?$expand=relations&api-version=7.0`,
    { headers: makeHeaders(pat) }
  );
  if (!res.ok) throw new Error(`ADO error ${res.status} fetching relations for ${id}`);
  return res.json();
}

async function batchFetch(pat, ids, fields) {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const res = await fetch(
      `${BASE_URL}/wit/workitems?ids=${batch.join(",")}&fields=${fields}&api-version=7.0`,
      { headers: makeHeaders(pat) }
    );
    if (!res.ok) throw new Error(`ADO batch fetch error ${res.status}`);
    const data = await res.json();
    out.push(...(data.value ?? []));
  }
  return out;
}

async function batchFetchRelations(pat, ids) {
  if (!ids.length) return [];
  const out = [];
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200);
    const res = await fetch(
      `${BASE_URL}/wit/workitems?ids=${batch.join(",")}&$expand=relations&api-version=7.0`,
      { headers: makeHeaders(pat) }
    );
    if (!res.ok) throw new Error(`ADO batch relations error ${res.status}`);
    const data = await res.json();
    out.push(...(data.value ?? []));
  }
  return out;
}

function getChildIds(relations) {
  return (relations ?? [])
    .filter((r) => r.rel === "System.LinkTypes.Hierarchy-Forward")
    .map((r) => parseInt(r.url.split("/").pop(), 10))
    .filter(Boolean);
}

function normalize(raw) {
  const f = raw.fields;
  return {
    id: raw.id,
    title: f["System.Title"] ?? "",
    state: f["System.State"] ?? "Unknown",
    assignee: f["System.AssignedTo"]?.displayName ?? "Unassigned",
    workItemType: f["System.WorkItemType"] ?? "",
    iterationPath: f["System.IterationPath"] ?? "",
    areaPath: f["System.AreaPath"] ?? "",
    priority: f["Microsoft.VSTS.Common.Priority"] ?? null,
    severity: f["Microsoft.VSTS.Common.Severity"] ?? null,
    storyPoints: f["Microsoft.VSTS.Scheduling.StoryPoints"] ?? null,
    tags: f["System.Tags"] ?? "",
    changedDate: f["System.ChangedDate"],
    url: `https://dev.azure.com/${ORG}/${PROJECT}/_workitems/edit/${raw.id}`,
  };
}

function classifyBug(bug) {
  const area = bug.areaPath.toLowerCase();
  const tags = bug.tags.toLowerCase();
  if (area.includes("commerce") || tags.includes("commerce")) return "Commerce";
  if (area.includes("content") || tags.includes("content")) return "Content";
  return "Other";
}

export async function fetchFeatureBugs(pat, featureId) {
  // Fetch feature fields + relations in parallel
  const [featureRaw, featureRelRaw] = await Promise.all([
    fetchSingle(pat, featureId, FEATURE_FIELDS),
    fetchSingleRelations(pat, featureId),
  ]);

  const feature = normalize(featureRaw);
  const storyIds = getChildIds(featureRelRaw.relations);

  if (!storyIds.length) return { feature, stories: [] };

  // Fetch user story fields + relations in parallel
  const [rawStories, storyRelations] = await Promise.all([
    batchFetch(pat, storyIds, STORY_FIELDS),
    batchFetchRelations(pat, storyIds),
  ]);

  const stories = rawStories
    .filter((r) => r.fields["System.WorkItemType"] === "User Story")
    .map(normalize);

  const storyRelMap = {};
  for (const r of storyRelations) storyRelMap[r.id] = r.relations ?? [];

  // Collect all child IDs from stories (bugs + tasks)
  const childIdSet = new Set();
  const storyChildIds = {};
  for (const story of stories) {
    const ids = getChildIds(storyRelMap[story.id]);
    storyChildIds[story.id] = ids;
    ids.forEach((id) => childIdSet.add(id));
  }

  // Fetch all children, then filter to bugs only
  const bugMap = {};
  if (childIdSet.size > 0) {
    const rawChildren = await batchFetch(pat, [...childIdSet], BUG_FIELDS);
    rawChildren
      .filter((r) => r.fields["System.WorkItemType"] === "Bug")
      .forEach((r) => { bugMap[r.id] = normalize(r); });
  }

  const enrichedStories = stories.map((story) => {
    const bugs = (storyChildIds[story.id] ?? [])
      .map((id) => bugMap[id])
      .filter(Boolean)
      .map((bug) => ({ ...bug, category: classifyBug(bug) }));

    return {
      ...story,
      commerceBugs: bugs.filter((b) => b.category === "Commerce"),
      contentBugs: bugs.filter((b) => b.category === "Content"),
      otherBugs: bugs.filter((b) => b.category === "Other"),
    };
  });

  return { feature, stories: enrichedStories };
}
