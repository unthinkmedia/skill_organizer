# Custom Editor Patterns

Use custom editors when users need specialized file editing/viewing.

## Use Cases

- Structured config editing with validation.
- Rich visual editing for domain-specific files.
- Readonly viewers for non-text or generated artifacts.

## Required Practices

- Implement proper lifecycle hooks.
- Keep document and UI state synchronized.
- Preserve undo/redo and dirty state semantics.
- Add robust parse and validation error handling.
- Dispose listeners/resources on editor close.

## Boundary

If editor UI becomes heavily interactive and web-heavy, route WebView internals through `vscode-webview-elements`.
