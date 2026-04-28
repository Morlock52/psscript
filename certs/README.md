# Local Certificates

This directory is reserved for local-only development certificates.

Do not commit generated private keys or certificates here. The previously tracked local certificate material was preserved under `archive/local-private-material-2026-04-28/` so it is not lost, but anything that was ever used outside disposable local development should be treated as compromised and rotated outside the codebase.

Use environment variables such as `TLS_CERT` and `TLS_KEY` to point local tooling at freshly generated files. The Playwright stack now generates short-lived local certificates under `output/playwright/certs/` when needed, so e2e tests do not depend on archived private keys.
