import { createHash } from "node:crypto";

/**
 * Non-reversible handle for a session id. Event hooks, plugins and the
 * notifications table must never receive the raw cookie credential.
 */
export const toSessionRef = (sessionId: string) =>
  createHash("sha256").update(sessionId).digest("hex").slice(0, 16);
