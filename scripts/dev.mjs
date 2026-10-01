import { runtime } from "./runtime.mjs";
const { mf } = await runtime({ port: 8793, persist: true });
console.log("Microcinema preview: http://localhost:8793");
console.log(
  "Admin: http://localhost:8793/admin/ — alonso@dustwave.xyz (local test link; no email sent)",
);
console.log(
  "Writers Group is imported once. Changes persist in this local database. No sample events are added.",
);
process.on("SIGINT", async () => {
  await mf.dispose();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await mf.dispose();
  process.exit(0);
});
await mf.ready;
