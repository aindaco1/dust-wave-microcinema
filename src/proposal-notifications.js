import {
  createOutboxJobId,
  outboxRetryDelayMs,
} from "@dustwave/worker-core/outbox";
import { automaticEmailHeaders } from "@dustwave/worker-core/email";
import { email } from "./domain.js";
import { local, origin } from "./security.js";
export const NOTIFICATION_CRON = "*/5 * * * *";
export async function notificationStatement(
  env,
  id,
  proposal,
  payloadHash = null,
) {
  if (!env.PROPOSAL_NOTIFY_TO) return null;
  const recipient = email(env.PROPOSAL_NOTIFY_TO);
  const jobId = await createOutboxJobId({
    kind: "microcinema-proposal",
    dedupeKey: id,
  });
  const payload = {
    from: { email: env.LOGIN_FROM, name: "Dust Wave Microcinema" },
    to: recipient,
    replyTo: proposal.email,
    subject: `New Microcinema proposal: ${proposal.title.replace(/[\r\n]/g, " ")}`,
    text: `A new event proposal is ready for review.\n\n${proposal.title}\n${proposal.date} at ${proposal.time} (Albuquerque time)\n\n${proposal.description}\n\nFrom: ${proposal.name}\nEmail: ${proposal.email}\n\nReview in Microcinema admin:\n${origin(env)}/admin/#proposals\n\nReference: ${id}\nThis proposal has not been published or booked.`,
    headers: automaticEmailHeaders(),
  };
  return env.DB.prepare(
    "INSERT OR IGNORE INTO proposal_notifications(id,proposal_id,payload,next_attempt_at) SELECT ?,?,?,? WHERE EXISTS (SELECT 1 FROM proposals WHERE id=? AND (? IS NULL OR payload_hash=?))",
  ).bind(
    jobId,
    id,
    JSON.stringify(payload),
    Date.now(),
    id,
    payloadHash,
    payloadHash,
  );
}
export async function drainNotifications(env) {
  if (local(env) || !env.EMAIL || !env.PROPOSAL_NOTIFY_TO) return;
  const now = Date.now();
  // A crashed/uncertain send is never retried automatically: this provider has
  // no idempotency key. The saved proposal and attention status remain visible.
  await env.DB.prepare(
    "UPDATE proposal_notifications SET status='uncertain',last_error='send_interrupted' WHERE status='sending' AND lease_until<=?",
  )
    .bind(now)
    .run();
  const { results } = await env.DB.prepare(
    "SELECT id FROM proposal_notifications WHERE status='pending' AND next_attempt_at<=? ORDER BY next_attempt_at LIMIT 10",
  )
    .bind(now)
    .all();
  for (const candidate of results) {
    const lease = crypto.randomUUID();
    const job = await env.DB.prepare(
      "UPDATE proposal_notifications SET status='sending',attempts=attempts+1,lease_token=?,lease_until=? WHERE id=? AND status='pending' AND next_attempt_at<=? RETURNING *",
    )
      .bind(lease, Date.now() + 120000, candidate.id, now)
      .first();
    if (!job) continue;
    let status = "accepted",
      provider = "",
      error = "",
      next = 0;
    const payload = JSON.parse(job.payload);
    if (payload.to !== env.PROPOSAL_NOTIFY_TO.trim().toLowerCase()) {
      status = "failed";
      error = "recipient_changed";
    } else {
      try {
        const result = await env.EMAIL.send(payload);
        if (!result?.messageId) throw new Error("unknown_result");
        provider = result.messageId;
      } catch (failure) {
        error = /^E_[A-Z_]+$/.test(failure?.code || "")
          ? failure.code
          : "unknown_result";
        const retry =
          ["E_RATE_LIMIT_EXCEEDED", "E_DAILY_LIMIT_EXCEEDED"].includes(error) &&
          job.attempts < 8;
        status = retry
          ? "pending"
          : error === "unknown_result" || error === "E_INTERNAL_SERVER_ERROR"
            ? "uncertain"
            : "failed";
        if (retry)
          next =
            Date.now() +
            outboxRetryDelayMs(
              {
                retryAfterSeconds:
                  error === "E_DAILY_LIMIT_EXCEEDED" ? 86400 : 0,
              },
              job.attempts - 1,
              {
                minimumMs: 300000,
                maximumMs: 86400000,
              },
            );
      }
    }
    await env.DB.prepare(
      "UPDATE proposal_notifications SET status=?,provider_id=?,last_error=?,next_attempt_at=?,lease_until=0,lease_token='' WHERE id=? AND lease_token=?",
    )
      .bind(status, provider, error, next, job.id, lease)
      .run();
    if (status === "pending") break;
  }
}
export async function deliverNotifications(env) {
  try {
    await drainNotifications(env);
  } catch {
    console.error("Microcinema proposal notification dispatch failed");
  }
}
