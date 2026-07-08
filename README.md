# ADO Dashboard – Emerson Quality Assurance Team

A React dashboard that queries Azure DevOps User Stories under:

**Organization:** `EmersonAutomationSolutions`  
**Project:** `EMR-DigMod`  
**Area Path:** `EMR-DigMod\EMR DCX IT\Emerson Quality Assurance Team`

## Features

- Displays all non-removed User Stories under the configured area path
- **Group by Assignee** or **Group by Iteration**
- Summary stat tiles (total stories, stories per state, story points)
- Search by title, assignee name, ID, or tags
- Filter by state (New / Active / Resolved / Closed)
- Click any card to open the work item directly in ADO
- Refresh on demand; disconnect clears the PAT from memory

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and paste your Azure DevOps PAT when prompted.

### PAT requirements

Create a PAT at `https://dev.azure.com/EmersonAutomationSolutions/_usersSettings/tokens` with:

- **Scope:** Work Items – Read

The PAT is used in-memory only for the current browser session and is never stored.

## Build

```bash
npm run build
```

Produces a static bundle in `dist/` that can be served from any web host.
