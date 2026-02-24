# Component Selection

Use this order of preference:

1. Native VS Code UI components.
2. Custom editors for specialized file editing/viewing.
3. WebViews only when native UI and custom editors cannot meet requirements.

## Native UI

Use for:
- Tree navigation and hierarchy.
- Search/select workflows.
- Commands, status, and settings.

## Custom Editors

Use for:
- Specialized file types.
- Visual or structured editing flows.

## WebViews

Use for:
- Rich data visualization.
- Complex custom layouts or media-heavy interfaces.
- Interactive content impossible with native components.

## Icon System Selection

Apply this when planning any new extension or migration.

1. Primary icon library: `@vscode/codicons`
- Use for command palette actions, tree items, status bar items, activity views, and any extension chrome.
- Prefer `vscode.ThemeIcon`/codicon names when an equivalent exists.

2. Fallback icon library: `Iconify`
- Use only when codicon coverage is insufficient for domain-specific concepts.
- Prefer consistent fallback sets (`lucide`, `tabler-icons`) instead of mixing many unrelated styles.

3. Size and alignment contract
- Default icon size: `16px`.
- Emphasis/large action size: `20px`.
- Inline-with-text size: `1em`.
- Keep fallback SVGs visually aligned to VS Code density and text baseline.

4. Decision rule
- If codicon exists and communicates the concept clearly, use codicon.
- If codicon is missing or ambiguous, use `Iconify` fallback and keep the shared size contract.
