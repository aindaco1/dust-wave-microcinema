# Validation — September 30, 2026

## Verified locally

- Production asset build and Worker deployment dry run.
- Real workerd/D1/R2 integration: login allowlist, single-use and expired tokens, secure session flags, logout revocation, Origin/CSRF protection, draft visibility, event creation, publication, editing, revision conflicts, cancellation, recoverable removal, restoration, archives, public proposals, private contact data and media access.
- Production mode fails closed without Turnstile configuration and cannot return the local sign-in link.
- D1 records and R2 objects survive a complete local runtime restart. Miniflare 5 uses `resourcePersistencePath`; the legacy per-resource persistence options are not used.
- Calendar date conversion across summer/winter and midnight, invalid calendar dates, ambiguous/nonexistent daylight-saving times, UTF-8 line folding, escaping, stable UIDs, revisions and cancellation status.
- Immutable platform commit, package versions and lockfile.
- Browser: local admin login; creation and publication; title, Spanish and ticket-link edits; JPEG-to-WebP upload and preview; Spanish public event rendering; platform confirmation dialog; remove and restore; narrow editor and public program without horizontal overflow; public proposal submission and private draft creation.
- Source formatting and dependency audit.
- Vector revision: original Dust Wave glove retained, film-reel variation applied to header/footer/placeholders, small-size favicon, live-text master and outlined web illustration, PNG exports and source notes. English copy uses US spelling; Spanish follows the rewritten meaning.

The local preview contains the imported Writers Group alongside explicitly labeled fictional program data. Live email delivery, live Turnstile, production resources, domain routing, and physical calendar-app import remain unverified until deployment.

## Deployment state

The custom domain resolves to Cloudflare nameservers. The local Wrangler login is expired and cannot refresh non-interactively. No production deployment or resource provisioning has been performed. The checked-in D1 ID remains a placeholder.

## Recurring events — October 1, 2026

- One-time English/Spanish Writers Group import, managed independently after import; restart preserves admin edits.
- Weekly/every-other-week recurrence projected three calendar months ahead, including month-end clamping, automatic rollover, archive entries, inclusive optional end date, overnight meetings, and Albuquerque daylight-saving changes.
- Stable per-meeting URLs and calendar UIDs through rescheduling; one VEVENT per download, with cancellation status and increasing revision.
- Integration checks cover recurrence creation, drafts and removed-series privacy, public English/Spanish pages, information links, the sitemap, end-date filtering, and optimistic edit conflicts.
- Browser checks: save and clear an end date; cancel, move, and reset a meeting; verify the public result and restore Writers Group to its normal schedule.
- Desktop and phone public/admin layouts reviewed at 1280px and 375px; no horizontal overflow in the expanded meeting editor. Spanish event details and the localized Writers Group information link were verified.
