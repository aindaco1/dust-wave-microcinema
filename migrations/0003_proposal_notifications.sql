ALTER TABLE proposals ADD COLUMN payload_hash TEXT;
CREATE TABLE proposal_notifications (
 id TEXT PRIMARY KEY,
 proposal_id TEXT NOT NULL UNIQUE REFERENCES proposals(id),
 payload TEXT NOT NULL CHECK (json_valid(payload)),
 status TEXT NOT NULL DEFAULT 'pending',
 attempts INTEGER NOT NULL DEFAULT 0,
 next_attempt_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0,
 lease_token TEXT NOT NULL DEFAULT '',
 provider_id TEXT NOT NULL DEFAULT '',
 last_error TEXT NOT NULL DEFAULT ''
);
CREATE INDEX proposal_notifications_due ON proposal_notifications(status,next_attempt_at);
