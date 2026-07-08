const ORG = "EmersonAutomationSolutions";
const PROJECT = "EMR-DigMod";
const AREA_PATH = "EMR-DigMod\\EMR DCX IT\\Emerson Quality Assurance Team";

const BASE_URL = `https://dev.azure.com/${ORG}/${PROJECT}/_apis`;

function makeHeaders(pat) {
  const token = btoa(`:${pat}`);
  return {
    Authorization: `Basic ${token}`,
    "Content-Type": "application/json",
  };
}

export async function fetchUserStories(pat) {
  const wiql = {
    query: `
      SELECT [System.Id], [System.Title], [System.State], [System.AssignedTo],
             [System.IterationPath], [System.AreaPath], [Microsoft.VSTS.Scheduling.StoryPoints],
             [System.CreatedDate], [System.ChangedDate], [System.Tags],
             [Microsoft.VSTS.Common.Priority]
      FROM WorkItems
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

  const wiqlData = await wiqlRes.json();
  const ids = wiqlData.workItems?.map((w) => w.id) ?? [];

  if (ids.length === 0) return [];

  // Fetch in batches of 200 (ADO limit)
  const fields = [
    "System.Id",
    "System.Title",
    "System.State",
    "System.AssignedTo",
    "System.IterationPath",
    "System.AreaPath",
    "Microsoft.VSTS.Scheduling.StoryPoints",
    "System.CreatedDate",
    "System.ChangedDate",
    "System.Tags",
    "Microsoft.VSTS.Common.Priority",
  ].join(",");

  const batches = [];
  for (let i = 0; i < ids.length; i += 200) {
    batches.push(ids.slice(i, i + 200));
  }

  const results = await Promise.all(
    batches.map(async (batch) => {
      const res = await fetch(
        `${BASE_URL}/wit/workitems?ids=${batch.join(",")}&fields=${fields}&api-version=7.0`,
        { headers: makeHeaders(pat) }
      );
      if (!res.ok) throw new Error(`ADO fetch error ${res.status}`);
      const data = await res.json();
      return data.value ?? [];
    })
  );

  return results.flat().map(normalizeItem);
}

function normalizeItem(raw) {
  const f = raw.fields;
  const assignedTo = f["System.AssignedTo"];
  return {
    id: raw.id,
    title: f["System.Title"] ?? "",
    state: f["System.State"] ?? "Unknown",
    assignee: assignedTo?.displayName ?? "Unassigned",
    assigneeEmail: assignedTo?.uniqueName ?? "",
    iterationPath: f["System.IterationPath"] ?? "",
    areaPath: f["System.AreaPath"] ?? "",
    storyPoints: f["Microsoft.VSTS.Scheduling.StoryPoints"] ?? null,
    priority: f["Microsoft.VSTS.Common.Priority"] ?? null,
    tags: f["System.Tags"] ?? "",
    createdDate: f["System.CreatedDate"],
    changedDate: f["System.ChangedDate"],
    url: `https://dev.azure.com/${ORG}/${PROJECT}/_workitems/edit/${raw.id}`,
  };
}
