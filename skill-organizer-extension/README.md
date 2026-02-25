# Skill Organizer

Bring your best AI skills into every workspace without repetitive copy/paste.

Skill Organizer helps you import reusable skills from GitHub and `skills.sh`, choose what should be active, and keep your workspace materialized skills in sync.

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
- Workspace-level enable and disable controls.
- Global default toggle per skill.
- Apply global profile into the active workspace.
- Sync selected workspace skills into destination files.
- Organized sections in the Skills view:
	- Sources
	- Workspace Enabled
	- Global Defaults

## Quick Start

1. Open the **Skill Organizer** view in the Activity Bar.
2. Run `Skill Organizer: Add Source`.
3. Choose GitHub or `skills.sh`, then provide the source URL.
4. Enable the skills you want.
5. Run `Skill Organizer: Sync Workspace Skills` to materialize into `.github/skills`.

## Commands

- `Skill Organizer: Add Source`
- `Skill Organizer: Refresh Skills`
- `Skill Organizer: Extend AGENTS.md`
- `Skill Organizer: Enable or Disable Skill`
- `Skill Organizer: Toggle Global Default`
- `Skill Organizer: Apply Global Profile to Workspace`
- `Skill Organizer: Sync Workspace Skills`

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
