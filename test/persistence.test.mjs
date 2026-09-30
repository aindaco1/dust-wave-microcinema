import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { runtime } from "../scripts/runtime.mjs";
test("local event data and uploaded images survive a complete runtime restart", async () => {
  await mkdir("work", { recursive: true });
  const path = await mkdtemp(resolve("work/persistence-test-"));
  let instance;
  try {
    instance = await runtime({ persist: path });
    await instance.db
      .prepare(
        "INSERT INTO proposals(id,state,created_at,data) VALUES ('durable','pending','2040-01-01','{}')",
      )
      .run();
    await (
      await instance.mf.getR2Bucket("IMAGES")
    ).put("durable.webp", "durable-image");
    await instance.mf.dispose();
    instance = null;
    instance = await runtime({ persist: path });
    assert.equal(
      (
        await instance.db
          .prepare("SELECT id FROM proposals WHERE id='durable'")
          .first()
      ).id,
      "durable",
    );
    assert.equal(
      await (
        await (await instance.mf.getR2Bucket("IMAGES")).get("durable.webp")
      ).text(),
      "durable-image",
    );
  } finally {
    await instance?.mf.dispose();
    await rm(path, { recursive: true, force: true });
  }
});
