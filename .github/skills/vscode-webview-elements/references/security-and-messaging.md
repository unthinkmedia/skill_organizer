# Security and Messaging

## CSP Baseline

- `default-src 'none'`
- `script-src` with nonce
- `style-src` scoped to webview source
- Restrictive `img-src`, `font-src`, and `connect-src`

## Messaging Rules

- Validate message shape and allowed commands.
- Sanitize user-controlled strings before rendering or storage.
- Return structured errors instead of throwing raw objects to UI.

## Resource Hygiene

- Dispose listeners on panel dispose.
- Avoid unbounded timers and stale subscriptions.
