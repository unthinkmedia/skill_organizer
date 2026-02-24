---
name: vscode-extension-implementation
description: Implement VS Code extensions using native UI first and custom editors where needed. Use for TreeView, QuickPick, commands, settings, activation/lifecycle, and specialized file editing experiences. Do not use for WebView-heavy work; route that to vscode-webview-elements.
---

# VS Code Extension Implementation

Implement extension code with native UI first and strong lifecycle hygiene.

## Workflow

1. Read `references/implementation-checklist.md`.
2. Implement native UI pieces first:
- Commands and activation events.
- Tree views, quick picks, status bar, settings.
3. Add custom editors only when file-type workflows require it.
4. Apply performance and disposal patterns before final output.
5. Return code changes plus verification notes.

## Required References

- `references/native-ui-patterns.md`
- `references/custom-editor-patterns.md`
- `references/implementation-checklist.md`

## Hard Rules

- Prefer native VS Code APIs over custom UI.
- Register and dispose all resources through `context.subscriptions`.
- Avoid broad activation (`"*"`) unless absolutely required.
- If WebView is required at any point, hand off to `vscode-webview-elements`.
