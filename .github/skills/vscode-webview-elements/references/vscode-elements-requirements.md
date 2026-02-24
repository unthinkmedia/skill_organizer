# VS Code Elements Requirements

## Mandatory

- Install dependency: `@vscode-elements/elements`.
- Use `vscode-*` controls for interactive UI when available.
- Use VS Code theme variables/tokens for visual integration.

## Minimum Component Coverage

- Buttons: `vscode-button`
- Text input: `vscode-textfield` or `vscode-textarea`
- Selection: `vscode-dropdown`, `vscode-checkbox`, `vscode-radio`
- Feedback: `vscode-progressbar`, `vscode-badge`

## Anti-Patterns

- Plain HTML form controls for primary interaction when VS Code Elements equivalents exist.
- Hardcoded colors that ignore VS Code themes.
