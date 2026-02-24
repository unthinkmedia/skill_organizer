---
name: vscode-extension-orchestrator
description: Orchestrate end-to-end VS Code extension development from concept or design through implementation, testing, and packaging. Use for new extension planning, migration from agent/prompt workflows, and deciding between native UI, WebViews, and custom editors. Enforce mandatory VS Code Elements whenever WebViews are required.
---

# VS Code Extension Orchestrator

Drive the full workflow and route work to specialized skills.

## Inputs

- Extension goal, target users, and required UX outcomes.
- Existing repo state or desired greenfield scaffold.

## Outputs

- A routed execution plan (native, custom editor, or WebView path).
- A release-readiness checklist with unresolved risks.

## Workflow

1. Clarify scope and output goals.
2. Confirm bootstrap baseline exists (manifest, scripts, test harness, CI entrypoint).
3. Select UI strategy using `references/component-selection.md`.
4. Select icon strategy before implementation begins:
- Default to VS Code-native `@vscode/codicons` for all extension chrome and command/tree/status icons.
- Require a documented fallback for domain-specific icons; default fallback is `Iconify` with preferred sets (`lucide` or `tabler-icons`).
- Require explicit size contract (`16px` default, `20px` emphasis, `1em` inline text) for non-codicon assets.
5. Route implementation:
- Use `vscode-extension-implementation` for native UI and custom editors.
- Use `vscode-webview-elements` for any WebView work.
6. Route verification and release prep to `vscode-extension-qa-packaging`.
7. Confirm publish strategy and rollback path before final sign-off.
8. Produce final implementation plan or completed changes.

## Hard Rules

- Use native VS Code UI first.
- Do not approve implementation work until a minimal extension scaffold is present and validated.
- Do not approve extension scaffolding plans without an explicit icon policy (`Codicons` primary + fallback set + size contract).
- If any WebView is needed, read `references/webview-gate.md` and then use `vscode-webview-elements`.
- Do not approve WebView output unless VS Code Elements is used for interactive controls.
- Do not mark release-ready without explicit test commands, CI-required checks, and publish channel decisions.

## Migration Guidance

Use `references/migration-map.md` to replace legacy `.github/agents`, `.github/prompts`, and `.github/instructions` usage with skill-first routing.
