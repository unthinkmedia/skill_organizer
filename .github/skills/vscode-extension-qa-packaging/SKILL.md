---
name: vscode-extension-qa-packaging
description: Validate and package VS Code extensions for release. Use for test planning, quality gates, accessibility/performance checks, CI workflows, VSIX packaging, and marketplace readiness.
---

# VS Code Extension QA Packaging

Validate behavior and prepare release artifacts.

## Workflow

1. Read `references/test-matrix.md`.
2. Validate core flows:
- Command and activation behavior.
- Native UI or editor behavior.
- WebView security and accessibility when applicable.
3. Run quality gates from `references/release-gates.md`.
4. Prepare package and docs using `references/marketplace-readiness.md`.
5. Return pass/fail summary with release checklist.

## Required References

- `references/test-matrix.md`
- `references/release-gates.md`
- `references/marketplace-readiness.md`

## Hard Rules

- Do not mark ready when critical tests fail.
- Do not mark ready when WebView security checks fail.
- Do not mark ready without basic marketplace metadata and docs.
