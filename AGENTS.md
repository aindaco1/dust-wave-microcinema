# Working on Microcinema

Keep this a small independent consumer of Dust Wave Platform. Use Node.js 24+.

- Application source: `src/`; static assets: `public/`; local development/build helpers: `scripts/`; D1 schema: `migrations/`.
- Keep event models, database bindings, sessions, secrets, content and deployment in this repository. Do not read or write Community/Writers Group storage.
- Shared primitives are an immutable git submodule. Update its full commit, exact package versions, lockfile and `test/platform.test.mjs` together after review. Do not duplicate an available primitive.
- Keep English/Spanish interface text together in `src/copy.js`. User-authored Spanish is optional; English fallback is deliberate.
- Preserve SSR public pages, stable event URLs, private proposal data, draft visibility, optimistic revisions, origin/CSRF checks and production's fail-closed authentication.
- Test behavior with `npm run check`, check formatting with `npm run format:check`, and run `git diff --check`. Run `npm run deploy:check` for Worker/config changes. Review visual changes in the rendered desktop and mobile UI.
- Build output, local databases, uploads, caches, credentials and logs are ignored. `work/` is local scratch. Never commit them.
- `npm run dev` uses local sample events and sends no email. It is not production acceptance. Keep live deployment, DNS, provider delivery and physical-device validation distinct from local checks.
