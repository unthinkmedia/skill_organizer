---
name: vscode-extension-orchestrator
description: Orchestrate end-to-end VS Code extension development from concept or design through implementation, testing, and packaging. Use for new extension planning, migration from agent/prompt workflows, and deciding between native UI, WebViews, and custom editors. Enforce mandatory VS Code Elements whenever WebViews are required.
---

# VS Code Extension Orchestrator

Drive the full workflow and route work to specialized skills.

## Workflow

1. Clarify scope and output goals.
2. Select UI strategy using `references/component-selection.md`.
3. Route implementation:
- Use `vscode-extension-implementation` for native UI and custom editors.
- Use `vscode-webview-elements` for any WebView work.
4. Route verification and release prep to `vscode-extension-qa-packaging`.
5. Produce final implementation plan or completed changes.

## Hard Rules

- Use native VS Code UI first.
- If any WebView is needed, read `references/webview-gate.md` and then use `vscode-webview-elements`.
- Do not approve WebView output unless VS Code Elements is used for interactive controls.

## Migration Guidance

Use `references/migration-map.md` to replace legacy `.github/agents`, `.github/prompts`, and `.github/instructions` usage with skill-first routing.
