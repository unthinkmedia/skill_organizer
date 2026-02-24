# Release Gates

A release is ready only when all gates pass.

## Gate 1: Functional

- Critical user flows pass.
- No known blocker defects.
- Automated test suite for affected areas passes.

## Gate 2: Security

- No critical security issues.
- WebView CSP and message checks pass when WebViews exist.
- Dependency vulnerability scan has no unresolved critical findings.

## Gate 3: Performance

- No major startup or interaction regressions.
- Resource cleanup confirmed.
- Activation remains scoped to declared events.

## Gate 4: Accessibility

- Keyboard navigation paths covered.
- High-contrast/theme compatibility validated.
- Reduced-motion behavior considered for animated UI.

## Gate 5: Packaging

- Build/package steps succeed.
- Metadata, README, and license are present.
- VSIX installs successfully in a clean profile smoke test.

## Gate 6: Operational Compliance

- Telemetry behavior is documented and can be disabled through configuration.
- Privacy statement or README section explains collected diagnostics.
- Localization plan is defined for user-facing strings (for example, `vscode-nls` strategy).
- Required CI checks are configured as blocking for protected branches.
