# Native UI Patterns

Use native APIs first.

## Preferred Components

- Tree data: `TreeDataProvider` and `createTreeView`.
- Selection/search: `showQuickPick`, `showInputBox`, or multi-step quick pick flows.
- Discoverability: `commands` + command palette.
- Lightweight status: `StatusBarItem`.
- Configuration: `workspace.getConfiguration` + contributed settings.

## Implementation Notes

- Keep handlers small and async-safe.
- Use `withProgress` for longer operations.
- Show actionable errors with clear user messages.
- Respect workspace trust and permission boundaries.
