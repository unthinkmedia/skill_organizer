# Skill Organizer Extension (MVP)

This extension bootstraps skill imports from external repositories into your workspace.

## Current MVP

- Add source from one entry point (`Add Source`) with provider selection
- Add GitHub source repos (public/private using local git credentials)
- Add GitHub tree folder URLs (for example `.../tree/main/tools/skills`)
- Add source from `skills.sh` URL
- Discover skills from known folder patterns
- Enable or disable skills per workspace
- Auto-sync enabled skills into workspace files (`.github/skills` by default)
- Toggle global default state per skill
- Apply global defaults into the active workspace
- Materialize enabled skills into workspace files (`.github/skills` by default)
- Organized tree sections with iconography: Sources, Workspace Enabled, Global Defaults

## Commands

- `Skill Organizer: Add Source`
- `Skill Organizer: Actions`
- `Skill Organizer: Refresh Skills`
- `Skill Organizer: Enable or Disable Skill`
- `Skill Organizer: Toggle Global Default`
- `Skill Organizer: Apply Global Profile to Workspace`
- `Skill Organizer: Materialize Enabled Skills to Workspace`

## Configuration

- `skillOrganizer.destinationPath`: workspace-relative destination for materialized skills (default: `.github/skills`)
- `skillOrganizer.materializationMode`: currently supports `copy`
