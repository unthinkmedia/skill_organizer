# Release Gates

A release is ready only when all gates pass.

## Gate 1: Functional

- Critical user flows pass.
- No known blocker defects.

## Gate 2: Security

- No critical security issues.
- WebView CSP and message checks pass when WebViews exist.

## Gate 3: Performance

- No major startup or interaction regressions.
- Resource cleanup confirmed.

## Gate 4: Accessibility

- Keyboard navigation paths covered.
- High-contrast/theme compatibility validated.

## Gate 5: Packaging

- Build/package steps succeed.
- Metadata, README, and license are present.
