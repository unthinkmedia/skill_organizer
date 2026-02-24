# Implementation Checklist

1. Confirm extension goals and contribution points.
2. Validate project scaffold:
- `package.json` with `engines.vscode`, `main`, and contribution points.
- Scripts for `build`, `lint` (if used), `test`, and package step.
- `tsconfig.json` and stable source/output directories.
3. Define icon policy for the extension scaffold:
- Primary icon set is `@vscode/codicons`.
- Fallback icon source is documented (default `Iconify` with one preferred style set).
- Shared icon sizes are defined (`16px` default, `20px` emphasis, `1em` inline).
4. Define specific activation events.
5. Implement commands with error handling.
6. Implement native UI (TreeView/QuickPick/StatusBar/Settings) as needed.
7. Add custom editor only for specialized file workflows.
8. Register every disposable in `context.subscriptions`.
9. Validate command discoverability and keyboard flows.
10. Validate performance and startup impact.
11. Add executable tests for implemented behavior:
- Unit/integration tests for core logic.
- Extension host tests (for command and activation behavior).
12. Ensure user-facing errors are actionable and non-technical where possible.
13. Confirm workspace trust and permission boundaries are respected.
14. If telemetry is added, gate it behind configuration and document collection purpose.
