# VS Code Extension Development (Skills-First)

Use this workflow to build VS Code extensions with a skills-only path.

## Entry Point

Use `@vscode-extension-orchestrator` for all new extension requests.

Example:

```text
@vscode-extension-orchestrator Build a VS Code extension for [goal]. Prefer native UI first, and use WebViews only when justified.
```

## Skill Routing

1. `@vscode-extension-orchestrator`
Role: scope, architecture, and routing.
2. `@vscode-extension-implementation`
Role: commands, native UI, custom editors, lifecycle.
3. `@vscode-webview-elements`
Role: WebViews with mandatory VS Code Elements, CSP, and a11y.
4. `@vscode-extension-qa-packaging`
Role: testing, release gates, packaging, marketplace readiness.

## Mandatory WebView Rule

If WebViews are used, route through `@vscode-webview-elements`.

Required outcomes:

- `@vscode-elements/elements` configured.
- `vscode-*` controls used for interactive UI.
- Strict CSP with nonce.
- Message validation and sanitization.
- Theme and accessibility checks documented.

## Migration Notes

This document is additive and does not remove existing agent/prompt workflows.
Use it as the default path for new work while legacy paths are phased out.
