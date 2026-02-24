# Marketplace Readiness

## Metadata

- `name`, `displayName`, `description`, `version`, `engines.vscode`
- Commands, views, and configuration contributions are accurate.

## Documentation

- README includes value, install, usage, and settings sections.
- CHANGELOG updated for release scope.

## Packaging

- Package command succeeds and artifact can be installed locally.
- Ignore unnecessary files in package (via `.vscodeignore` or equivalent).

## Pre-Publish Checklist

1. Run tests.
2. Run build/package.
3. Validate extension install in a clean VS Code profile.
4. Confirm no critical issues from smoke test.
