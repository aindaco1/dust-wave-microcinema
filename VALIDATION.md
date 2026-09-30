# Validation — September 30, 2026

## Verified locally

- Production asset build and Worker deployment dry run.
- Real workerd/D1/R2 integration: login allowlist, single-use and expired tokens, secure session flags, logout revocation, Origin/CSRF protection, draft visibility, event creation, publication, editing, revision conflicts, cancellation, recoverable removal, restoration, archives, public proposals, private contact data and media access.
- Production mode fails closed without Turnstile configuration and cannot return the local sign-in link.
- D1 records and R2 objects survive a complete local runtime restart. Miniflare 5 uses `resourcePersistencePath`; the legacy per-resource persistence options are not used.
- Calendar date conversion across summer/winter and midnight, invalid calendar dates, ambiguous/nonexistent daylight-saving times, UTF-8 line folding, escaping, stable UIDs, revisions and cancellation status.
- Immutable platform commit, package versions and lockfile.
- Browser: local admin login; creation and publication; title, Spanish and ticket-link edits; JPEG-to-WebP upload and preview; Spanish public event rendering; platform confirmation dialog; remove and restore; narrow editor and public programme without horizontal overflow; public proposal submission and private draft creation.
- Source formatting and dependency audit.

The public preview contains explicitly labelled fictional programme data. Live email delivery, live Turnstile, production resources, domain routing, and physical calendar-app import remain unverified until deployment.

## Deployment state

The custom domain resolves to Cloudflare nameservers. The local Wrangler login is expired and cannot refresh non-interactively. No production deployment or resource provisioning has been performed. The checked-in D1 ID remains a placeholder.
