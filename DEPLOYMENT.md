# Deploying Microcinema

The target is `https://dustwavemicrocinema.com`. This is an independent Worker deployment, with its own D1 database and R2 bucket. Existing Dust Wave Community resources are not reused.

## Provision once

1. Add the owned `dustwavemicrocinema.com` domain to the intended Cloudflare account and complete its nameserver setup.
2. Create `dust-wave-microcinema` with `npx wrangler d1 create dust-wave-microcinema`. Replace the all-zero `database_id` in `wrangler.jsonc` with the returned ID.
3. Create the private image bucket with `npx wrangler r2 bucket create dust-wave-microcinema-images`. Do not enable public bucket access; the Worker controls image visibility.
4. Create a dedicated Turnstile widget restricted to `dustwavemicrocinema.com` (and an explicitly chosen staging hostname if used). Add `TURNSTILE_SITE_KEY` under `vars`; save the secret with `npx wrangler secret put TURNSTILE_SECRET_KEY`.
5. Confirm the intended administrators in `ADMIN_EMAILS` (comma-separated). The allowlist is checked on every authenticated request. Removing an address immediately disables its sessions and pending sign-in links.
6. Configure Cloudflare Email Service for the verified `digest.dustwave.xyz` sender domain, and confirm that `microcinema@digest.dustwave.xyz` is authorized. The binding uses Cloudflare Email Service's object-based `send()` API, not the legacy raw-message forwarding API. A different sender requires matching changes to `LOGIN_FROM` and the email binding.
7. Add a custom-domain route to `wrangler.jsonc`:

```json
"routes": [{ "pattern": "dustwavemicrocinema.com", "custom_domain": true }],
"workers_dev": false
```

Keep `APP_MODE` set to `production` and `SITE_BASE` set to the exact HTTPS public origin. Local sign-in and challenge bypass require explicit local mode and a loopback origin; the deployed site must never use those settings.

## Apply and publish

```sh
npm ci
npm run check
npm run format:check
npm run deploy:check
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

`npm run deploy:check` only bundles the application. It does not prove that bindings exist, keys work, the domain resolves, or email is delivered.

## Verify the live service

- Request a sign-in link using an allowlisted address and verify delivery, exchange, and logout.
- Create a draft with artwork; confirm it and its artwork are unavailable to an unauthenticated visitor. Publish, edit, cancel, remove, and restore it.
- Verify English and Spanish event URLs, external ticket/RSVP destinations, and downloaded `.ics` times in a calendar application.
- Submit a proposal with the real Turnstile widget; verify its private admin record and its absence from public pages and sitemap.
- Check desktop and phone layouts, HTTPS, response headers, and the real venue information.
- Publish actual events through admin. Never import `scripts/demo.mjs` into production.

The old `dustwave.xyz/microcinema.html` page and its Community system require an explicit cutover decision before changing or redirecting them.

## Rollback and data

Keep the previous Worker deployment available for rollback. Back up D1 before schema migrations. Roll back source and its platform gitlink together; never advance the shared platform automatically. The initial schema is additive. A removed event retains its row for restoration; dismissed/accepted proposals retain their private records. Administrators should honor deletion requests by removing the corresponding proposal record from the independent database. Unattached image objects are retained; add lifecycle cleanup only when a retention policy has been chosen.

## References

- [Cloudflare static-asset binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare Email Service send bindings](https://developers.cloudflare.com/email-service/configuration/send-bindings/)
- [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545)
