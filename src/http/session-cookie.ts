import type { InstanceSettingsService } from "../services/instance-settings-service.js";

export async function sessionCookieAttributes(instanceSettingsService: InstanceSettingsService) {
  return {
    path: "/" as const,
    httpOnly: true,
    secure: await instanceSettingsService.shouldUseSecureCookies(),
    sameSite: "lax" as const
  };
}

export async function setSessionCookie(
  reply: { setCookie: (name: string, value: string, options: Record<string, unknown>) => void },
  instanceSettingsService: InstanceSettingsService,
  sessionId: string
) {
  reply.setCookie("sid", sessionId, {
    ...(await sessionCookieAttributes(instanceSettingsService)),
    maxAge: 60 * 60 * 8
  });
}

export async function clearSessionCookie(
  reply: { clearCookie: (name: string, options: Record<string, unknown>) => void },
  instanceSettingsService: InstanceSettingsService
) {
  reply.clearCookie("sid", await sessionCookieAttributes(instanceSettingsService));
}
