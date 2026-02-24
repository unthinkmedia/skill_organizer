# Skill Organizer Extension Plan

## Problem Statement

Skills are distributed across multiple repositories. Reusing them in new projects is slow because each project requires repeated manual selection, import, and curation.

This extension should provide a single place in VS Code to:

- Import skills from external sources.
- Enable or disable skills individually.
- Work with author-defined collections from source repositories (read-only).
- Build and maintain local editable collections for per-user workflows.

## Product Goals

- Reduce time to bootstrap skills in a new project.
- Support public and private repository imports.
- Support direct skill folder imports.
- Support `skills.sh` URLs as an alternate entrypoint.
- Keep source-owned collections immutable in the extension.
- Allow local custom collections that users can edit and update.

## Confirmed Decisions (From User)

- Default materialization target: active workspace.
- Private source support in V1: GitHub only.
- Local collections: can mix skills from different sources.
- Global profile support: required in addition to per-workspace toggles.

## Non-Goals (V1)

- Cloud sync for local collections across machines.
- Conflict-free merge editing of source repositories.
- Marketplace publishing/distribution of collections from this extension.

## Source Types

- `gitRepo`: GitHub repo URL (public/private).
- `localFolder`: Any local folder path containing one or more skills.
- `skillFolder`: Direct path to one specific skill directory.
- `skillsShUrl`: URL like `https://skills.sh/<owner>/<repo>/<skill-slug>`.

## Skills.sh Support

`skills.sh` should be handled as a resolver that maps to a canonical source and skill slug.

### Resolution Flow

1. Parse URL path segments: `<owner>/<repo>/<skillSlug>`.
2. Resolve canonical repo URL: `https://github.com/<owner>/<repo>`.
3. Register or reuse matching `gitRepo` source.
4. Import only the requested skill slug by default.
5. Optionally allow "import whole repo" from the same source.

### Fallbacks and Validation

- If URL parse fails, show actionable error with expected format.
- If slug is not found, offer "import repo and browse skills" fallback.
- If `skills.sh` metadata disagrees with repo contents, trust live repo scan and show warning.

## UX Strategy (Native-First)

Use native VS Code UI components in V1:

- Tree View: `Sources`, `Skills`, `Collections`.
- Quick Pick flows: add source, import from `skills.sh`, create local collection, toggle skills.
- Command palette entrypoints for all primary actions.
- Settings for defaults (destination path, sync behavior).

No WebView is required for V1.

## Information Architecture

### Views

- `Skill Sources`
	- source nodes with status (connected, auth required, sync pending).
- `Available Skills`
	- grouped by source, with enabled/disabled state.
- `Collections`
	- `Source Collections (Read Only)`
	- `Local Collections (Editable)`

### Core Commands

- `skillOrganizer.addSource`
- `skillOrganizer.addFromSkillsSh`
- `skillOrganizer.scanSource`
- `skillOrganizer.enableSkill`
- `skillOrganizer.disableSkill`
- `skillOrganizer.createLocalCollection`
- `skillOrganizer.addSkillToLocalCollection`
- `skillOrganizer.removeSkillFromLocalCollection`
- `skillOrganizer.syncSource`
- `skillOrganizer.applySelectionToWorkspace`

## Data Model

```ts
type SourceType = 'gitRepo' | 'localFolder' | 'skillFolder' | 'skillsShUrl';

interface SkillSource {
	id: string;
	type: SourceType;
	uri: string;
	canonicalRepoUri?: string;
	branch?: string;
	authMode?: 'ssh' | 'https' | 'pat' | 'system';
	lastSyncAt?: string;
}

interface SkillItem {
	id: string;
	sourceId: string;
	slug: string;
	relativePath: string;
	versionHash?: string;
	enabled: boolean;
}

interface SourceCollection {
	id: string;
	sourceId: string;
	name: string;
	memberSkillIds: string[];
	readOnly: true;
}

interface LocalCollection {
	id: string;
	name: string;
	memberSkillIds: string[];
	sourceLinks: Array<{ sourceId: string; skillId: string }>;
	updatedAt: string;
}
```

## Storage and State

- Global extension storage:
	- registered sources
	- local collections
	- cache of source scans
- Workspace storage:
	- enabled skills for this workspace
	- active collections for this workspace
- Global profile storage:
	- globally enabled skills (defaults for new workspaces)
	- globally active local collections
- Settings:
	- destination path (default `.github/skills`)
	- sync mode (`manual` | `onStartup`)
	- update policy (`prompt` | `autoSafe`)
	- materialization mode (`copy` | `symlink`)

## Author Collections vs Local Collections

### Author Collections

- Derived from repository metadata (for example `collections.json` or convention-based discovery).
- Presented as read-only.
- Can be activated/deactivated in a workspace.

### Local Collections

- User-created and editable.
- Can include skills across multiple sources.
- Track unresolved members when a source skill disappears.

## Sync and Update Behavior

- Manual sync command for each source.
- Optional startup sync for connected sources.
- On source update:
	- detect added/removed/changed skills
	- preserve workspace enable/disable where possible
	- mark missing members in local collections instead of deleting silently
	- keep "missing member" placeholders with actions: relink, remove, replace

### Recommended Update Policy for Local Collections

- If a skill changes in place: keep membership and surface "updated" badge.
- If a skill is removed/renamed: retain an unresolved member entry instead of auto-removal.
- Provide one-click repair actions:
  - `Relink to replacement skill`
  - `Remove from collection`
  - `Keep unresolved` (for temporary upstream drift)
- Never silently mutate local collections on sync.

## Security and Private Repos

- Prefer system git credentials/SSH agent.
- Support PAT-based HTTPS as optional configuration.
- Do not persist plaintext secrets in extension state.
- Store secrets in VS Code `SecretStorage` only.

## Materialization Strategy Recommendation

Recommended V1 default: `copy` into the active workspace destination path.

- Why copy first:
	- predictable and portable across machines/CI
	- avoids broken symlinks in remote/dev-container scenarios
	- easier to reason about when sharing repos
- Optional advanced mode later: `symlink` for power users who want live source linkage.

## V1 Implementation Phases

### Phase 1: Scaffold + Source Registry

- Create extension scaffold.
- Add source registry with add/remove/list.
- Add local folder and git repo scanning.

### Phase 2: Skills + Toggle + Apply

- Discover skills and expose in Tree View.
- Enable/disable per workspace.
- Materialize enabled skills into workspace destination path.

### Phase 3: Collections

- Load source read-only collections.
- Create/edit local collections.
- Activate collection to toggle member skills.

### Phase 4: Skills.sh Adapter

- Implement URL parse and canonical repo resolution.
- Add `Add from skills.sh` command.
- Handle slug not found fallback.

### Phase 5: QA + Packaging

- Add integration tests for imports/toggles/collections.
- Add private repo auth tests (mock and manual).
- Package and validate release gates.

## Open Decisions

- Canonical metadata format for source collections (`collections.json` schema).
- Collision policy when same skill slug exists in multiple sources.
- Default update policy for changed skills already enabled in workspace.

## Global Profile Semantics

Global profile means you do not need to re-add source locations for each workspace on the same machine.

- Sources are registered globally in extension state.
- New workspaces can optionally apply the global profile at first use.
- Existing workspaces can import from global profile on demand.
- This is independent from account login by default.
- Cross-machine persistence is possible later via VS Code Settings Sync support for profile metadata (never secrets).

## Suggested V1 Defaults

- Destination path: `.github/skills`.
- Sync mode: `manual`.
- Update policy: `prompt`.
- Materialization mode: `copy`.
- `skills.sh` import behavior: import selected slug only, with optional full-repo import.

