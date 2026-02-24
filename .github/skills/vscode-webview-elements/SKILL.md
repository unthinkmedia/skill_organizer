---
name: vscode-webview-elements
description: Build secure, performant VS Code WebViews with mandatory VS Code Elements usage. Use when native UI or custom editors cannot satisfy rich interactive UI requirements. Covers CSP, message validation, theme integration, accessibility, and @vscode-elements/elements setup.
---

# VS Code WebView Elements

Implement WebViews only when justified, and enforce VS Code Elements.

## Workflow

1. Read `references/webview-entry-gate.md`.
2. Install and configure `@vscode-elements/elements`.
3. Implement WebView UI with `vscode-*` components for interactive controls.
4. Apply CSP, message validation, and input sanitization.
5. Validate theme integration, keyboard navigation, and reduced-motion behavior.
6. Return implementation plus a gate checklist result.

## Required References

- `references/webview-entry-gate.md`
- `references/vscode-elements-requirements.md`
- `references/security-and-messaging.md`
- `references/webview-checklist.md`

## Hard Rules

- Never ship a WebView using plain HTML controls where VS Code Elements equivalents exist.
- Never skip strict CSP with nonce-based scripts.
- Never trust WebView messages without schema/command validation.
