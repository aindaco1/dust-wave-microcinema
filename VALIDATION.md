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

The local preview now contains only Writers Group in its public program. The four fictional events and one test draft were removed recoverably, with a private local backup. The sample seeder was removed so they cannot be reintroduced automatically.

## Production launch — September 30, 2026

- Cloudflare account access refreshed and verified; the previously recorded expired-login blocker no longer applies.
- Independent D1 database and private R2 bucket provisioned. Initial schema and Writers Group migration applied, with exactly one published series and no sample event rows.
- Worker deployed to `https://dustwavemicrocinema.com`, version `b277d8b9-df6f-4434-bb46-e4be5fd74494`; live HTTPS, custom-domain routing, D1 reads, static assets, and security headers verified.
- EN/ES programs, archives, individual event pages, visit, privacy, proposal and admin pages, robots, sitemap, and assets returned 200 from the real domain.
- Seven Writers Group dates appear from October 5 through December 28; the next date appears only in Up Next. Both archives are empty and every former sample event URL returns 404.
- Live single-meeting calendar downloads verified before and after the daylight-saving transition. Private admin APIs require authentication. Production rejects login without a Turnstile response and never exposes the local login shortcut.
- Dedicated Turnstile site key and Worker secret configured; the live admin widget completed successfully without interaction. The existing sending domain reports ready. A real admin sign-in request for the allowlisted address succeeded and Email Service accepted the message.
- Live desktop (1280px) and phone (375px) layouts reviewed with loaded imagery and no horizontal overflow. The archive empty state describes past events.
- Hidden filesystem metadata is excluded from the published asset build.

Email receipt, full production admin sign-in, and physical calendar-app import still require recipient/device verification. Local integration coverage does not establish those outcomes.

## Recurring events — September 30, 2026

- One-time English/Spanish Writers Group import, managed independently after import; restart preserves admin edits.
- Weekly/every-other-week recurrence projected three calendar months ahead, including month-end clamping, automatic rollover, archive entries, inclusive optional end date, overnight meetings, and Albuquerque daylight-saving changes.
- Stable per-meeting URLs and calendar UIDs through rescheduling; one VEVENT per download, with cancellation status and increasing revision.
- Integration checks cover recurrence creation, drafts and removed-series privacy, public English/Spanish pages, information links, the sitemap, end-date filtering, and optimistic edit conflicts.
- Browser checks: save and clear an end date; cancel, move, and reset a meeting; verify the public result and restore Writers Group to its normal schedule.
- Desktop and phone public/admin layouts reviewed at 1280px and 375px; no horizontal overflow in the expanded meeting editor. Spanish event details and the localized Writers Group information link were verified.
