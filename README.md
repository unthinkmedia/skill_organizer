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
- Sync workspace skills into `.github/skills` based on current selections
- Organized tree sections with iconography: Sources, Workspace Enabled, Global Defaults

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

- `skillOrganizer.destinationPath`: workspace-relative destination for materialized skills (default: `.github/skills`)
- `skillOrganizer.materializationMode`: currently supports `copy`

## Package and Share

### Build and package a VSIX

```bash
npm ci
npm run compile
npm run package
```

This generates a `.vsix` file you can share directly.

### Install from a VSIX

```bash
code --install-extension skill-organizer-extension-0.0.1.vsix
```

### Publish to Marketplace

1. Create a Marketplace publisher named `unthinkmedia`.
2. Create an Azure DevOps personal access token with Marketplace manage permissions.
3. Authenticate once:

```bash
npx @vscode/vsce login unthinkmedia
```

4. Publish:

```bash
npm run publish:patch
```
