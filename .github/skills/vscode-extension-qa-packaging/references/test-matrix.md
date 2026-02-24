# Test Matrix

Use explicit commands where possible and capture the exact command output in QA notes.

## Baseline Commands

- Install deps: `npm ci`
- Static checks: `npm run lint` (if configured)
- Build: `npm run build`
- Unit tests: `npm test` or `npm run test:unit`
- Extension host tests: `npm run test:extension` (commonly backed by `@vscode/test-electron`)
- Package smoke: `npx vsce package --no-yarn` (or project equivalent)

## Core

- Extension activation and command registration.
- Command happy path and error path behavior.
- Settings read/write behavior.
- Activation is limited to declared events (no unintended eager activation).

## Native UI

- Tree and quick-pick interactions.
- Status bar updates and disposal.
- Keyboard-first flow validated for command execution paths.

## Custom Editors

- Open/edit/save lifecycle.
- Validation and malformed input handling.
- Undo/redo and dirty-state behavior.

## WebView (if present)

- CSP present.
- Message validation/sanitization.
- VS Code Elements usage for interactive controls.
- Theme and keyboard behavior.

## CI Mapping

- Required checks should include at least: build, tests, and package smoke.
- Optional checks may include lint and coverage, but failures in required checks block release.
