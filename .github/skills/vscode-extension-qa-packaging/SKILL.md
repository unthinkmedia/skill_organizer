---
name: vscode-extension-qa-packaging
description: Validate and package VS Code extensions for release. Use for test planning, quality gates, accessibility/performance checks, CI workflows, VSIX packaging, and marketplace readiness.
---

# VS Code Extension QA Packaging

Validate behavior and prepare release artifacts.

## Inputs

- Implemented extension changes and declared release scope.
- Test/build/package commands and CI check configuration.

## Outputs

- Pass/fail gate report with blocking issues.
- Packaging and publish-readiness checklist, including rollback notes.

## Workflow

1. Read `references/test-matrix.md`.
2. Execute test matrix with concrete commands and collect pass/fail evidence.
3. Validate core flows:
- Command and activation behavior.
- Native UI or editor behavior.
- WebView security and accessibility when applicable.
4. Run quality gates from `references/release-gates.md` including CI-required checks.
5. Prepare package and docs using `references/marketplace-readiness.md`.
6. Validate publish channel, versioning mode (stable or pre-release), and rollback instructions.
7. Return pass/fail summary with release checklist.

## Required References

- `references/test-matrix.md`
- `references/release-gates.md`
- `references/marketplace-readiness.md`

## Hard Rules

- Do not mark ready when critical tests fail.
- Do not mark ready when WebView security checks fail.
- Do not mark ready without basic marketplace metadata and docs.
- Do not mark ready when required CI checks are missing or non-blocking.
- Do not mark ready when telemetry/privacy, localization plan, or dependency scan checks are incomplete.
