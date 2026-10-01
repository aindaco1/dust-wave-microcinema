# Dust Wave Microcinema

An independent, bilingual program and event editor for **dustwavemicrocinema.com**.

The public site includes upcoming events, individual event pages, an automatic archive, venue/parking information, and a private event-proposal inbox. Admins can create, edit, publish, cancel, remove, and restore events, upload artwork, and supply optional Spanish translations. Ticket buttons link to `shop.dustwave.xyz`; RSVP buttons link to an external HTTPS registration page. Calendar downloads use Albuquerque time and stable event IDs.

## Run locally

Requires Node.js 24 or newer.

```sh
git clone --recurse-submodules https://github.com/aindaco1/dust-wave-microcinema.git
cd dust-wave-microcinema
npm ci
npm run dev
```

Open **http://localhost:8793** and **http://localhost:8793/admin/**.
Use `alonso@dustwave.xyz` and select **Open local test sign-in**. Local development sends no email. Migrations import Writers Group once from its public Dust Wave page. No sample events are added. Restarting does not overwrite admin edits.

Local database and uploaded images persist under `.wrangler/local/`. To start a fresh local database with only the Writers Group import, move that directory aside and run `npm run dev`. The preview has no hot reload; restart `npm run dev` after source changes.

```sh
npm run check          # build plus domain, integration and platform-pin checks
npm run format:check   # source formatting
npm run deploy:check   # bundle for Cloudflare without deploying
```

## Architecture

One Cloudflare Worker renders HTML and serves the small API. D1 stores events, private proposals, hashed login tokens, sessions, and rate limits. A separate private R2 bucket stores uploaded WebP artwork. JavaScript is used for the admin and proposal forms; the program, navigation, event pages, archive, and calendar links work without it.

Shared code is pinned at `shared/dust-wave-platform` commit `0f84a675deb9577648b35ae0fd0ebed5e9abcb60`:

- `@dustwave/worker-core` **0.15.0**: request bounds, security headers, cookies, origin checks, crypto, time-zone conversion, and Turnstile verification.
- `@dustwave/admin-shell` **0.12.0**: API client, unsaved-change lifecycle, and accessible confirmation dialog.
- `@dustwave/test-core` **0.3.1**: immutable dependency verification in tests.

Microcinema owns its model, storage, admin allowlist, sessions, routes, and deployment. It does not read or mutate the existing Dust Wave Community or Writers Group database.

### Content rules

- English event title and description are required; empty Spanish fields fall back to English.
- Events use `America/Denver`; overnight events are supported. Repeated or skipped daylight-saving hours are rejected rather than guessed.
- Events can repeat weekly or every other week. An optional **Repeat until** date is inclusive; blank means ongoing. Each meeting gets a separate listing in a rolling three-calendar-month window, a stable `/events/series-slug/YYYY-MM-DD` page, and a single-meeting `.ics` file. Past meetings remain in the archive.
- One series record and its individual date changes are stored in the existing event JSON. Dates are projected on each request, so the window fills without cron jobs, duplicated content, or writes on public requests. Cancelling or moving a meeting preserves its original date-based URL and calendar UID.
- Admins edit the series once and can cancel, reschedule, or reset individual meetings. The original first date and repeat pattern stay fixed after saving a series; end it and create another to change the pattern. Other series edits apply to the whole series. Sunday repeat times from 1–2:59 a.m. are excluded to avoid ambiguous daylight-saving transitions.
- Page addresses are fixed after the first save. Past events move to the archive after their end time.
- Removal hides an event and its calendar file. Restore returns it as a draft. Cancellation retains a public notice and an ICS cancellation status.
- A public proposal is private until an admin turns it into a draft and publishes it. Name/email never enter the public event model. Proposals do not send notifications or subscribe anyone to a mailing list.
- An optional information link supports destinations such as the existing Writers Group reading lineup and script submissions. English and Spanish links can differ.
- Descriptions are plain text with paragraphs. Film metadata, audience notes, and guest information can be written in the details/description fields.
- Uploads are limited to JPEG/PNG/WebP, converted in the browser to a maximum 1,600-pixel WebP, and bounded and signature-checked by the Worker. Draft uploads require an admin session to read; published event artwork is public.
- Calendar files follow RFC 5545 escaping, CRLF and UTF-8 byte-folding rules. Downloaded files are snapshots, not a subscribed calendar feed.

### Writers Group import

`migrations/0002_writers_group.sql` imports the free, open Writers Group, starting October 5, 2026, every other Monday from 7–9 p.m. It has no end date. The English and Spanish copy was adapted from the public [Writers Group page](https://dustwave.xyz/writers-group.html#readings). Reading lineups and submissions remain there; dates and content are managed independently in this admin after import. No sync or Community storage access is involved.

## Production setup

See [DEPLOYMENT.md](DEPLOYMENT.md). Production uses its own D1 database and private R2 bucket, with the custom domain and public Turnstile site key in `wrangler.jsonc`. The Turnstile secret is stored in Cloudflare. Running the build or local preview does not change production data or deploy the site.

Design references and asset notices are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Validation evidence is in [VALIDATION.md](VALIDATION.md).

Editable logo and illustration masters, PNG exports, and construction notes are in [artwork/](artwork/README.md).
