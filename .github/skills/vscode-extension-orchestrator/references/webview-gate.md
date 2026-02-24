# WebView Gate

Before approving WebView architecture or implementation:

1. Confirm native UI and custom editor options were evaluated and rejected with reasons.
2. Require `@vscode-elements/elements` for interactive controls.
3. Require strict CSP with nonce-based scripts.
4. Require message validation and input sanitization.
5. Require theme token usage and keyboard accessibility checks.

If any check fails, return to design and revise.
