import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile } from "node:fs/promises";
export async function runtime({
  port = 0,
  persist = false,
  production = false,
} = {}) {
  const origin = `http://localhost:${port || 8793}`;
  const mf = new Miniflare(
    convertV4MiniflareOptions({
      host: "127.0.0.1",
      port,
      logLevel: "error",
      ...(persist
        ? {
            resourcePersistencePath:
              typeof persist === "string" ? persist : ".wrangler/local",
          }
        : {}),
      workers: [
        {
          name: "microcinema",
          modules: true,
          scriptPath: "dist/worker.js",
          compatibilityDate: "2026-09-07",
          d1Databases: ["DB"],
          r2Buckets: ["IMAGES"],
          serviceBindings: {
            ASSETS: async (request) => {
              const path = new URL(request.url).pathname;
              if (!/^\/assets\/[a-zA-Z0-9._-]+$/.test(path))
                return new Response("Not found", { status: 404 });
              const types = {
                css: "text/css",
                js: "text/javascript",
                svg: "image/svg+xml",
                jpg: "image/jpeg",
                webp: "image/webp",
                png: "image/png",
                woff2: "font/woff2",
                txt: "text/plain",
              };
              try {
                return new Response(await readFile("dist/public" + path), {
                  headers: {
                    "Content-Type":
                      types[path.split(".").at(-1)] ||
                      "application/octet-stream",
                  },
                });
              } catch {
                return new Response("Not found", { status: 404 });
              }
            },
          },
          bindings: {
            SITE_BASE: production ? "https://dustwavemicrocinema.com" : origin,
            APP_MODE: production ? "production" : "local",
            ADMIN_EMAILS: "alonso@dustwave.xyz",
            LOGIN_FROM: "microcinema@digest.dustwave.xyz",
          },
        },
      ],
    }),
  );
  await mf.ready;
  const db = await mf.getD1Database("DB");
  const migration = await readFile("migrations/0001_initial.sql", "utf8");
  for (const statement of migration
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean))
    await db.prepare(statement).run();
  return { mf, db, origin };
}
