# Skill Organizer

Bring your best AI skills into every workspace without repetitive copy/paste.

Import reusable skills from GitHub and `skills.sh`, choose what belongs in the current workspace, and keep materialized files in sync.

![Skill Organizer preview](./media/marketplace-preview.png)

## Why Skill Organizer

- Centralize reusable skills from multiple sources.
- Enable only what you need per workspace.
- Keep a global default profile for your go-to skills.
- Materialize selected skills into `.github/skills` automatically.
- Manage everything from a single, structured tree view.

## Key Features

- One-click `Add Source` flow with provider selection.
- GitHub repository source support (public or private with local git credentials).
- GitHub `tree` URL support (for example: `.../tree/main/tools/skills`).
- Direct import from `skills.sh` URLs.
- Skill discovery from common folder patterns.
- **LLM-powered skill search** — describe what you need in natural language and let a language model find the best match from your catalog. Falls back to fuzzy substring matching when LM is unavailable.
- **Submit Skill as PR** — contribute a local skill back to any GitHub repository directly from the extension. Supports submitting to existing sources, arbitrary repos, or creating a new repo on the fly. Forks automatically when you lack push access.
- Workspace-level enable and disable controls.
- Global default toggle per skill.
- Manual vs managed materialized skill tracking.
- Apply global profile into the active workspace.
- Sync selected workspace skills into destination files.
- Organized sections in the Skills view:
  - Sources
  - Materialized
  - Workspace Enabled
  - Global Defaults

## Quick Start

1. Open the **Skill Organizer** view in the Activity Bar.
2. Run `Skill Organizer: Add Source`.
3. Choose GitHub or `skills.sh`, then provide the source URL.
4. Enable the skills you want.
5. Run `Skill Organizer: Apply Sync (Overwrite Managed Skills)` to materialize into `.github/skills`.
6. Optional: Use `Detach from Source` in the Materialized section to protect a copied skill from updates.

### Searching Skills

Run `Skill Organizer: Search Skills` and describe what you need (e.g. "help me deploy" or "set up auth"). When a language model is available, the search uses LLM-powered semantic matching to surface the most relevant skills. Otherwise it falls back to fast fuzzy matching. Select a result to toggle it on or off.

### Contributing a Skill via PR

Run `Skill Organizer: Submit Skill as PR` (or use the context menu on a materialized skill) to open a pull request that adds the skill to a GitHub repository. You can target an existing source, enter any GitHub URL, or create a brand-new repo. If you don't have push access, a fork is created automatically.

## Commands

- `Skill Organizer: Add Source`
- `Skill Organizer: Refresh Skills`
- `Skill Organizer: Extend AGENTS.md`
- `Skill Organizer: Enable or Disable Skill`
- `Skill Organizer: Toggle Global Default`
- `Skill Organizer: Apply Global Profile to Workspace`
- `Skill Organizer: Apply Sync (Overwrite Managed Skills)`
- `Skill Organizer: Detach from Source`
- `Skill Organizer: Reconnect to Source`
- `Skill Organizer: Update Managed Skill`
- `Skill Organizer: Uninstall Materialized Skill`
- `Skill Organizer: Search Skills`
- `Skill Organizer: Submit Skill as PR`

## Manual vs Managed Skills

Skill Organizer tracks materialized folders in `.skill-organizer.manifest.json`:

```json
{
  "managedFolders": ["example-skill"],
  "manualFolders": ["my-handcrafted-skill"]
}
```

- Managed (`package`) skills are updated/replaced by sync.
- Manual (`manual`) skills are protected from sync updates and removals.
- Existing manifests migrate automatically by adding `manualFolders: []` when missing.

### Protection Rules

- Sync skips manual folders (they remain untouched).
- `Update Managed Skill` is only available for managed entries.
- `Uninstall Materialized Skill` requires force confirmation for manual entries.
- `Detach from Source` and `Reconnect to Source` move skills between manifest arrays.

Most management actions are also available from the `...` title menu in the Skills view.

## Configuration

- `skillOrganizer.destinationPath`
  - Workspace-relative destination for materialized skills.
  - Default: `.github/skills`
- `skillOrganizer.materializationMode`
  - Materialization strategy.
  - Current supported value: `copy`

## Repository

- Source: `https://github.com/unthinkmedia/skill_organizer`
- Issues: `https://github.com/unthinkmedia/skill_organizer/issues`
