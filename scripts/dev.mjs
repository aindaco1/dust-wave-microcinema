import { runtime } from "./runtime.mjs";
import { seedDemo } from "./demo.mjs";
const { mf, db } = await runtime({ port: 8793, persist: true });
if (!process.argv.includes("--empty")) await seedDemo(db);
console.log("Microcinema preview: http://localhost:8793");
console.log(
  "Admin: http://localhost:8793/admin/ — alonso@dustwave.xyz (local test link; no email sent)",
);
console.log(
  "Sample events are local only. The production migration creates an empty programme.",
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
