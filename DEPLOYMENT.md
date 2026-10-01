# Deploying Microcinema

The target is `https://dustwavemicrocinema.com`. This is an independent Worker deployment, with its own D1 database and R2 bucket. Existing Dust Wave Community resources are not reused.

## Production configuration

Provisioned September 30, 2026 in the Dust Wave Cloudflare account:

- Custom domain: `dustwavemicrocinema.com`; Workers.dev and preview URLs are disabled.
- Worker: `dust-wave-microcinema`.
- D1: `dust-wave-microcinema`, ID `28a360bf-93f1-4c2f-8ba7-c03a30c77487`. The initial schema and Writers Group import are applied and recorded in `d1_migrations`.
- Private R2: `dust-wave-microcinema-images`. The Worker controls image visibility.
- Dedicated managed Turnstile widget restricted to `dustwavemicrocinema.com`. The public site key is in `wrangler.jsonc`; `TURNSTILE_SECRET_KEY` is stored as a Worker secret.
- Admin allowlist: `alonso@dustwave.xyz`. Removing an address immediately disables its sessions and pending sign-in links.
- Sender: `microcinema@digest.dustwave.xyz`, using the existing verified `digest.dustwave.xyz` sending domain. Its provider DNS status was verified ready. The binding uses Cloudflare Email Service's object-based `send()` API and permits only that sender.
- Daily cleanup of expired sessions, login tokens, and rate-limit records at 09:17 UTC. Recurring event listings are projected on requests and do not depend on this job.

Keep `APP_MODE` set to `production` and `SITE_BASE` set to the exact HTTPS public origin. Local sign-in and challenge bypass require explicit local mode and a loopback origin; the deployed site must never use those settings. The initial production database contains only the Writers Group series. No sample data was imported.

## Apply and publish

```sh
npm ci
npm run check
npm run format:check
npm run deploy:check
# Includes the one-time Writers Group import.
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

If the authenticated CLI lacks D1 permissions, apply pending SQL through the authorized Cloudflare API and record each completed filename in the standard `d1_migrations` table. Never mark a failed migration complete or re-import event content over admin edits.

`npm run deploy:check` only bundles the application. It does not prove that bindings exist, keys work, the domain resolves, or email is delivered.

## Verify the live service

- Request a sign-in link using an allowlisted address and verify delivery, exchange, and logout.
- Create a draft with artwork; confirm it and its artwork are unavailable to an unauthenticated visitor. Publish, edit, cancel, remove, and restore it.
- Verify English and Spanish event URLs, external ticket/RSVP destinations, and downloaded `.ics` times in a calendar application.
- Submit a proposal with the real Turnstile widget; verify its private admin record and its absence from public pages and sitemap.
- Check desktop and phone layouts, HTTPS, response headers, and the real venue information.
- Check the imported Writers Group series in admin, including its repeat schedule, optional end date, individual-date changes, and upcoming three-month window.
- Publish other actual events through admin. Local development adds no fictional events.

The old `dustwave.xyz/microcinema.html` page and its Community system require an explicit cutover decision before changing or redirecting them.

## Rollback and data

Keep the previous Worker deployment available for rollback. Back up D1 before schema migrations. Roll back source and its platform gitlink together; never advance the shared platform automatically. The initial schema is additive. A removed event retains its row for restoration; dismissed/accepted proposals retain their private records. Administrators should honor deletion requests by removing the corresponding proposal record from the independent database. Unattached image objects are retained; add lifecycle cleanup only when a retention policy has been chosen.

## References

- [Cloudflare static-asset binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare Email Service send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)
