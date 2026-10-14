export class SamlReplayProtectionService {
  private readonly seen = new Map<string, number>();

  constructor(private readonly defaultTtlMs = 5 * 60 * 1000) {}

  /**
   * Returns true when responseId has not been seen before and is now reserved until expiry.
   */
  reserve(responseId: string, notOnOrAfter?: Date): boolean {
    this.cleanup();

    const now = Date.now();
    const key = responseId.trim();
    if (!key) {
      return false;
    }

    const existingExpiry = this.seen.get(key);
    if (existingExpiry && existingExpiry > now) {
      return false;
    }

    const expiresAt = notOnOrAfter?.getTime();
    const ttlExpiry = now + this.defaultTtlMs;
    this.seen.set(key, expiresAt && Number.isFinite(expiresAt) ? Math.max(expiresAt, now + 1) : ttlExpiry);
    return true;
  }

  private cleanup() {
    const now = Date.now();
    for (const [key, expiresAt] of this.seen.entries()) {
      if (expiresAt <= now) {
        this.seen.delete(key);
      }
    }
  }
}
