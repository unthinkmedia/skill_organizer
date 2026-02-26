# Changelog

All notable changes to this project are documented in this file.

## [0.0.8] - 2026-02-26

### Added
- Added manual vs managed manifest schema support with automatic legacy migration (`manualFolders` added when missing).
- Added Materialized section in the Skills tree with visual manual (`✋`) and managed (`📦`) indicators.
- Added commands: `Mark as Manual`, `Mark as Managed`, `Update Managed Skill`, and `Uninstall Materialized Skill`.

### Changed
- Sync now skips manual protected skills instead of overwriting them.
- skills.sh import flow now supports installing directly as manual (protected).

## [0.0.1] - 2026-02-25

### Added
- Initial Skill Organizer MVP extension release.
- Source onboarding via a single "Add Source" entry point.
- Source support for GitHub repositories, GitHub tree URLs, and `skills.sh` URLs.
- Skill discovery from known folder patterns.
- Workspace-level enable and disable state for skills.
- Materialization of enabled skills into `.github/skills` (copy mode).
- Global default profile toggles and apply-to-workspace support.
- Workspace sync flow for selected skills.
- Tree view organization for Sources, Workspace Enabled, and Global Defaults.
- Commands for refresh, profile apply, workspace sync, and AGENTS.md extension.
