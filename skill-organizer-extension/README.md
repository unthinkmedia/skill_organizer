# Skill Organizer

Bring your best AI skills into every workspace — no more copy/paste.

Import reusable [Copilot Custom Instructions](https://code.visualstudio.com/docs/copilot/copilot-customization) from GitHub repositories and [skills.sh](https://skills.sh), pick what each workspace needs, and keep everything in sync automatically.

![Skill Organizer sidebar](media/screenshot-sidebar.png)

---

## Features

### Centralized Skill Management

Browse and enable skills from multiple GitHub repositories in one organized sidebar. Skills are grouped into clear sections — **Enabled Skills**, **Available Sources**, **Active Skills**, and **Global Skills** — so you always know what is active and where it came from.

### Browse & Multi-Select Skills

Use the **Browse Source Skills** picker to search, preview descriptions, and enable multiple skills at once.

![Browse Source Skills picker](media/screenshot-browse-skills.png)

### LLM-Powered Search

Run **Search Skills** and describe what you need in natural language (e.g. "help me deploy" or "set up auth"). When a language model is available, the search uses semantic matching. Otherwise it falls back to fast fuzzy matching.

### Submit Skills as Pull Requests

Contribute a local skill back to any GitHub repository directly from the extension. Pick a target repo, or create a new one on the fly. The extension auto-forks when you don't have push access.

![Target Repository picker](media/screenshot-submit-pr.png)

### Managed vs Manual Skills

- **Managed** skills stay in sync with their source — updates are pulled automatically.
- **Manual** skills are protected from overwrites, so your custom edits are safe.
- Switch between modes anytime with **Detach from Source** / **Reconnect to Source**.

### Global Defaults

Star your go-to skills to sync them into `~/.agents/skills` across all workspaces.

---

## Quick Start

1. Open the **Skill Organizer** view in the Activity Bar.
2. Click **Add Source** and provide a GitHub repo URL or skills.sh link.
3. Enable the skills you want for this workspace.
4. Run **Resync Managed Skills** to copy them into `.github/skills`.

That's it — your selected skills are now available to Copilot in this workspace.

---

## Commands

| Command | Description |
|---------|-------------|
| `Add Source` | Add a GitHub repo or skills.sh URL as a skill source |
| `Refresh Skills` | Pull latest changes from all sources |
| `Search Skills` | Find skills by natural language description |
| `Browse Source Skills` | Multi-select picker for a source's skills |
| `Submit Skill as PR` | Contribute a skill back to a GitHub repo |
| `Enable or Disable Skill` | Toggle a skill for the current workspace |
| `Toggle Global Default` | Star a skill for all workspaces |
| `Resync Managed Skills` | Re-copy managed skills to `.github/skills` |
| `Detach from Source` | Protect a local skill from sync updates |
| `Reconnect to Source` | Resume sync for a detached skill |
| `Update Managed Skill` | Pull latest version of a single skill |
| `Remove Local Skill` | Delete a skill from `.github/skills` |
| `Review AGENTS.md with Copilot` | Update your AGENTS.md with enabled skills |

---

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `skillOrganizer.destinationPath` | `.github/skills` | Where enabled skills are copied in the workspace |
| `skillOrganizer.globalDestinationPath` | `~/.agents/skills` | Where global default skills are synced |
| `skillOrganizer.materializationMode` | `copy` | How skills are materialized locally |

---

## How It Works

1. **Sources** — Point the extension at GitHub repos containing `SKILL.md` files. The extension clones them locally and discovers all available skills.
2. **Enable** — Check the skills you want for this workspace. They're copied into `.github/skills` so Copilot can use them.
3. **Sync** — Managed skills update automatically when you refresh. Manual skills are protected from changes.
4. **Share** — Submit any local skill back to a GitHub repo as a PR, complete with auto-forking for repos you don't own.

---

## Requirements

- VS Code 1.90 or later
- Git installed and available on PATH
- GitHub authentication (prompted automatically for private repos and PR submission)

---

## Links

- [Source Code](https://github.com/unthinkmedia/skill_organizer)
- [Report Issues](https://github.com/unthinkmedia/skill_organizer/issues)
- [Changelog](CHANGELOG.md)
