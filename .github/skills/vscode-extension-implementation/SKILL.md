---
name: vscode-extension-implementation
description: Implement VS Code extensions using native UI first and custom editors where needed. Use for TreeView, QuickPick, commands, settings, activation/lifecycle, and specialized file editing experiences. Do not use for WebView-heavy work; route that to vscode-webview-elements.
---

# VS Code Extension Implementation

Implement extension code with native UI first and strong lifecycle hygiene.

## Inputs

- Approved implementation scope and contribution points.
- Current scaffold state and target VS Code engine range.

## Outputs

- Implemented extension changes with disposal/performance hygiene.
- Verification notes with commands run and observed results.

## Workflow

1. Read `references/implementation-checklist.md`.
2. Create or validate extension scaffold:
- `package.json` contributions and activation events.
- Build/lint/test scripts.
- `tsconfig.json` and source layout.
- Extension test harness.
3. Define icon system for the scaffold before UI implementation:
- Set `@vscode/codicons` as primary icon source.
- Add fallback support (default `Iconify`) only when required for missing concepts.
- Enforce shared size contract (`16px` default, `20px` emphasis, `1em` inline).
4. Implement native UI pieces first:
- Commands and activation events.
- Tree views, quick picks, status bar, settings.
5. Add custom editors only when file-type workflows require it.
6. Apply performance and disposal patterns before final output.
7. Run local verification commands and capture results.
8. Return code changes plus verification notes.

## Required References

- `references/native-ui-patterns.md`
- `references/custom-editor-patterns.md`
- `references/implementation-checklist.md`

## Hard Rules

- Prefer native VS Code APIs over custom UI.
- Prefer codicons/`vscode.ThemeIcon` before any third-party icon set.
- Register and dispose all resources through `context.subscriptions`.
- Avoid broad activation (`"*"`) unless absolutely required.
- Do not leave scaffold-critical items undefined (`engines.vscode`, contributions, scripts, test harness).
- If WebView is required at any point, hand off to `vscode-webview-elements`.
