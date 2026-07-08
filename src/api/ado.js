const ORG = "EmersonAutomationSolutions";
const PROJECT = "EMR-DigMod";
const AREA_PATH = "EMR-DigMod\\EMR DCX IT\\Emerson Quality Assurance Team";
const BASE_URL = `https://dev.azure.com/${ORG}/${PROJECT}/_apis`;

const FIELDS = [
  "System.Id",
  "System.Title",
  "System.State",
  "System.AssignedTo",
  "System.WorkItemType",
  "System.IterationPath",
  "System.AreaPath",
  "Microsoft.VSTS.Scheduling.StoryPoints",
  "Microsoft.VSTS.Common.Priority",
  "System.CreatedDate",
  "System.ChangedDate",
  "System.Tags",
].join(",");

function makeHeaders(pat) {
  return {
    Authorization: `Basic ${btoa(`:${pat}`)}`,
    "Content-Type": "application/json",
  };
}

async function batchFetch(pat, ids) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(
        `${BASE_URL}/wit/workitems?ids=${batch.join(",")}&fields=${FIELDS}&api-version=7.0`,
        { headers: makeHeaders(pat) }
      );
      if (!res.ok) throw new Error(`ADO fetch error ${res.status}`);
      const data = await res.json();
      return data.value ?? [];
    })
  );
  return results.flat();
}

async function batchFetchRelations(pat, ids) {
  const batches = [];
  for (let i = 0; i < ids.length; i += 200) batches.push(ids.slice(i, i + 200));
  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(
        `${BASE_URL}/wit/workitems?ids=${batch.join(",")}&$expand=relations&api-version=7.0`,
        { headers: makeHeaders(pat) }
      );
      if (!res.ok) throw new Error(`ADO fetch error ${res.status}`);
      const data = await res.json();
      return data.value ?? [];
    })
  );
  return results.flat();
}

function normalizeName(assignedTo) {
  if (!assignedTo) return "Unassigned";
  return assignedTo.displayName ?? "Unassigned";
}

function normalizeItem(raw) {
  const f = raw.fields;
  return {
    id: raw.id,
    title: f["System.Title"] ?? "",
    state: f["System.State"] ?? "Unknown",
    assignee: normalizeName(f["System.AssignedTo"]),
    workItemType: f["System.WorkItemType"] ?? "",
    iterationPath: f["System.IterationPath"] ?? "",
    areaPath: f["System.AreaPath"] ?? "",
    storyPoints: f["Microsoft.VSTS.Scheduling.StoryPoints"] ?? null,
    priority: f["Microsoft.VSTS.Common.Priority"] ?? null,
    tags: f["System.Tags"] ?? "",
    createdDate: f["System.CreatedDate"],
    changedDate: f["System.ChangedDate"],
    url: `https://dev.azure.com/${ORG}/${PROJECT}/_workitems/edit/${raw.id}`,
    // keep raw relations for task linking
    _relations: raw.relations ?? [],
  };
}

export async function fetchUserStories(pat) {
  // Step 1: WIQL — get all User Story IDs under the area path
  const wiql = {
    query: `
      SELECT [System.Id] FROM WorkItems
      WHERE [System.WorkItemType] = 'User Story'
        AND [System.AreaPath] UNDER '${AREA_PATH}'
        AND [System.State] <> 'Removed'
      ORDER BY [System.ChangedDate] DESC
    `,
  };
  const wiqlRes = await fetch(`${BASE_URL}/wit/wiql?api-version=7.0`, {
    method: "POST",
    headers: makeHeaders(pat),
    body: JSON.stringify(wiql),
  });
  if (!wiqlRes.ok) {
    const text = await wiqlRes.text();
    throw new Error(`ADO WIQL error ${wiqlRes.status}: ${text}`);
  }
  const { workItems = [] } = await wiqlRes.json();
  const storyIds = workItems.map((w) => w.id);
  if (!storyIds.length) return [];

  // Step 2: Fetch story fields and relations in parallel (separate requests — ADO rejects both combined)
  const [rawStories, rawRelations] = await Promise.all([
    batchFetch(pat, storyIds),
    batchFetchRelations(pat, storyIds),
  ]);
  const stories = rawStories.map(normalizeItem);

  // Step 3: Collect unique child task IDs from hierarchy-forward relations
  const relMap = {};
  for (const raw of rawRelations) relMap[raw.id] = raw.relations ?? [];

  const taskIdSet = new Set();
  const storyTaskIds = {};
  for (const story of stories) {
    const childIds = (relMap[story.id] ?? [])
      .filter((r) => r.rel === "System.LinkTypes.Hierarchy-Forward")
      .map((r) => parseInt(r.url.split("/").pop(), 10))
      .filter(Boolean);
    storyTaskIds[story.id] = childIds;
    childIds.forEach((id) => taskIdSet.add(id));
  }

  // Step 4: Batch-fetch tasks (if any)
  const taskMap = {};
  if (taskIdSet.size > 0) {
    const rawTasks = await batchFetch(pat, [...taskIdSet]);
    rawTasks.forEach((raw) => {
      taskMap[raw.id] = normalizeItem(raw);
    });
  }

  // Step 5: Attach tasks to their parent story
  return stories.map((story) => ({
    ...story,
    tasks: (storyTaskIds[story.id] ?? [])
      .map((id) => taskMap[id])
      .filter(Boolean),
  }));
}
