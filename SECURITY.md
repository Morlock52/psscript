# Security Policy

## Reporting Vulnerabilities

Do not report suspected vulnerabilities in public issues.

Email the repository owner or use GitHub private vulnerability reporting if it is enabled for this repository. Include:

- affected component or route
- reproduction steps
- observed impact
- logs or screenshots with secrets redacted
- suggested fix, if known

## Sensitive Data Rules

- Never commit `.env` files, API keys, private certificates, database dumps, or production backups.
- Keep `.env.example` sanitized and safe to commit.
- Use the backend settings and environment configuration paths for provider secrets; do not place long-lived provider keys in frontend state or browser storage.
- Redact tokens, cookies, database URLs, and authorization headers in logs and screenshots.

## Supported Scope

Current security-sensitive areas:

- authentication and authorization middleware
- script upload, export, and analysis routes
- admin database maintenance routes
- AI provider and voice-provider configuration
- PostgreSQL, Redis, pgvector, and backup/restore workflows
- frontend settings pages that surface operational controls

## Related Docs

- [docs/SECURITY_INCIDENT_RESPONSE.md](./docs/SECURITY_INCIDENT_RESPONSE.md)
- [docs/USER_MANAGEMENT_SECURITY_AUDIT.md](./docs/USER_MANAGEMENT_SECURITY_AUDIT.md)
- [docs/DATA-MAINTENANCE.md](./docs/DATA-MAINTENANCE.md)
