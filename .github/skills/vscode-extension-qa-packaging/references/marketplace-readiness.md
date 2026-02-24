# Marketplace Readiness

## Metadata

- `name`, `displayName`, `description`, `version`, `engines.vscode`
- Commands, views, and configuration contributions are accurate.
- `publisher`, `repository`, and `bugs` links are present for supportability.

## Documentation

- README includes value, install, usage, and settings sections.
- CHANGELOG updated for release scope.
- README includes telemetry/privacy note if diagnostics are collected.

## Packaging

- Package command succeeds and artifact can be installed locally.
- Ignore unnecessary files in package (via `.vscodeignore` or equivalent).
- Publish target and commands are defined (`vsce` and/or Open VSX workflow).

## Versioning and Channels

- Decide stable vs pre-release before packaging.
- For pre-release, use a clear prerelease version strategy and release notes callout.
- Confirm extension compatibility range matches `engines.vscode` policy.

## Rollback Plan

- Define how to unpublish/deprecate or supersede a bad release.
- Keep previous known-good VSIX artifact and version notes available.
- Document emergency contact/owner for release incidents.

## Pre-Publish Checklist

1. Run tests.
2. Run build/package.
3. Validate extension install in a clean VS Code profile.
4. Confirm no critical issues from smoke test.
5. Verify required CI checks are green and blocking.
6. Confirm channel choice (stable or pre-release) and rollback notes.
