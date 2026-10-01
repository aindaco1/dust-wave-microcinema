import { build } from "esbuild";
import sharp from "sharp";
import { cp, mkdir, rm } from "node:fs/promises";
import { basename } from "node:path";
await rm("dist", { recursive: true, force: true });
await mkdir("dist/public", { recursive: true });
await cp("public", "dist/public", {
  recursive: true,
  filter: (source) => !basename(source).startsWith("."),
});
await Promise.all([
  sharp("public/assets/room.jpg")
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toFile("dist/public/assets/room.webp"),
  sharp("public/assets/parking.png")
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile("dist/public/assets/parking.webp"),
]);
await Promise.all([
  rm("dist/public/assets/room.jpg"),
  rm("dist/public/assets/parking.png"),
]);
await build({
  entryPoints: ["src/admin.js", "src/public.js"],
  bundle: true,
  outdir: "dist/public/assets",
  format: "esm",
  target: "es2022",
  minify: true,
});
await build({
  entryPoints: ["src/worker.js"],
  bundle: true,
  outfile: "dist/worker.js",
  format: "esm",
  platform: "browser",
  target: "es2022",
  minify: false,
});
