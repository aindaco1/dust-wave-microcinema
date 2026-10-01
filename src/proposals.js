import { sha256Hex, sha256BytesHex } from "@dustwave/worker-core/crypto";
import { readBoundedBytes } from "@dustwave/worker-core/request-validation";
import { text, email, fail, localInstant } from "./domain.js";
import { body, challenge, json, limit, sameOrigin } from "./security.js";
import { IMAGE_LIMIT, proposalImage } from "./proposal-images.js";
import {
  notificationStatement,
  deliverNotifications,
} from "./proposal-notifications.js";
export async function submitProposal(req, env, ctx) {
  sameOrigin(req, env);
  await limit(req, env, "proposal", 8);
  let data, file;
  if (req.headers.get("content-type")?.startsWith("multipart/form-data")) {
    const bytes = await readBoundedBytes(req, IMAGE_LIMIT + 20000);
    let form;
    try {
      form = await new Response(bytes, {
        headers: { "Content-Type": req.headers.get("content-type") },
      }).formData();
    } catch {
      fail("invalid_request");
    }
    data = Object.fromEntries(form);
    file = form.get("image");
    if (file && typeof file !== "string" && file.size === 0) file = null;
    if (file && (typeof file === "string" || file.size > IMAGE_LIMIT))
      fail("file_too_large");
  } else data = await body(req, 16000);
  if (
    data.website ||
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
      data.id || "",
    )
  )
    fail("invalid_request");
  const proposal = {
    title: text(data.title, 160, true),
    description: text(data.description, 6000, true),
    date: text(data.date, 10, true),
    time: text(data.time, 5, true),
    name: text(data.name, 100, true),
    email: email(data.email),
    lang: data.lang === "es" ? "es" : "en",
  };
  const imageBytes = file ? new Uint8Array(await file.arrayBuffer()) : null;
  const hash = await sha256Hex(
    JSON.stringify({
      ...proposal,
      imageDigest: imageBytes ? await sha256BytesHex(imageBytes) : "",
    }),
  );
  const previous = await env.DB.prepare(
    "SELECT payload_hash FROM proposals WHERE id=?",
  )
    .bind(data.id)
    .first();
  if (previous) {
    if (previous.payload_hash !== hash) fail("duplicate_submission", 409);
    return json({ ok: true, id: data.id });
  }
  if (localInstant(proposal.date, proposal.time) <= new Date().toISOString())
    fail("invalid_date");
  await challenge(req, env, data.token, "proposal");
  let key = "";
  try {
    if (imageBytes) {
      const bytes = await proposalImage(imageBytes, env.IMAGE_PROCESSOR);
      key = crypto.randomUUID() + ".webp";
      await env.IMAGES.put(key, bytes, {
        httpMetadata: { contentType: "image/webp" },
      });
      proposal.image = "/media/" + key;
    }
    const notification = await notificationStatement(
      env,
      data.id,
      proposal,
      hash,
    );
    const result = await env.DB.batch([
      env.DB.prepare(
        "INSERT OR IGNORE INTO proposals(id,state,created_at,data,payload_hash) VALUES (?,'pending',?,?,?)",
      ).bind(data.id, new Date().toISOString(), JSON.stringify(proposal), hash),
      ...(notification ? [notification] : []),
    ]);
    if (!result[0].meta.changes) {
      const winner = await env.DB.prepare(
        "SELECT payload_hash FROM proposals WHERE id=?",
      )
        .bind(data.id)
        .first();
      if (key) await env.IMAGES.delete(key);
      key = "";
      if (winner?.payload_hash !== hash) fail("duplicate_submission", 409);
    }
    ctx?.waitUntil(deliverNotifications(env));
    return json({ ok: true, id: data.id }, 201);
  } catch (error) {
    // A response may be lost after a commit. Keep artwork referenced by the saved proposal.
    if (key) {
      const saved = await env.DB.prepare(
        "SELECT json_extract(data,'$.image') AS image FROM proposals WHERE id=?",
      )
        .bind(data.id)
        .first();
      if (saved?.image !== "/media/" + key) await env.IMAGES.delete(key);
    }
    throw error;
  }
}
