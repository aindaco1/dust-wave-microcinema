import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { readFile, readdir } from "node:fs/promises";
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
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS local_migrations (name TEXT PRIMARY KEY)",
    )
    .run();
  for (const name of (await readdir("migrations"))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    if (
      await db
        .prepare("SELECT name FROM local_migrations WHERE name=?")
        .bind(name)
        .first()
    )
      continue;
    const migration = await readFile(`migrations/${name}`, "utf8");
    const statements = migration
      .split(/;\s*(?:\n|$)/)
      .map((s) => s.trim())
      .filter(Boolean);
    await db.batch([
      ...statements.map((sql) => db.prepare(sql)),
      db.prepare("INSERT INTO local_migrations(name) VALUES (?)").bind(name),
    ]);
  }
  return { mf, db, origin };
}
