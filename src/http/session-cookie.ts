import type { InstanceSettingsService } from "../services/instance-settings-service.js";

export const SESSION_COOKIE_NAME = "sid";

export async function sessionCookieAttributes(instanceSettingsService: InstanceSettingsService) {
  return {
    path: "/" as const,
    httpOnly: true,
    secure: await instanceSettingsService.shouldUseSecureCookies(),
    sameSite: "lax" as const
  };
}

/**
 * The session id is stored in the database and surfaces in audit metadata,
 * admin session lists and event payloads. The cookie therefore carries an
 * HMAC-signed value: knowing a session id alone is not enough to present it
 * as a cookie.
 */
export async function setSessionCookie(
  reply: { setCookie: (name: string, value: string, options: Record<string, unknown>) => void },
  instanceSettingsService: InstanceSettingsService,
  sessionId: string
) {
  reply.setCookie(SESSION_COOKIE_NAME, sessionId, {
    ...(await sessionCookieAttributes(instanceSettingsService)),
    maxAge: 60 * 60 * 8,
    signed: true
  });
}

export async function clearSessionCookie(
  reply: { clearCookie: (name: string, options: Record<string, unknown>) => void },
  instanceSettingsService: InstanceSettingsService
) {
  reply.clearCookie(SESSION_COOKIE_NAME, await sessionCookieAttributes(instanceSettingsService));
}

type CookieRequest = {
  cookies?: Record<string, string | undefined>;
  unsignCookie?: (value: string) => { valid: boolean; value: string | null };
};

/**
 * Reads and verifies the signed session cookie. Returns undefined for a
 * missing cookie, a tampered signature, or a legacy unsigned value.
 */
export function readSessionIdFromRequest(request: CookieRequest): string | undefined {
  const raw = request.cookies?.[SESSION_COOKIE_NAME];
  if (!raw || typeof request.unsignCookie !== "function") {
    return undefined;
  }

  const unsigned = request.unsignCookie(raw);
  if (!unsigned.valid || !unsigned.value) {
    return undefined;
  }

  return unsigned.value;
}
