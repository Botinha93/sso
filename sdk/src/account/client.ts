import type { ClientInstance } from "../core/types.js";
import type {
  AccountAPI,
  TotpEnrollmentComplete,
  TotpEnrollmentStart,
  TotpStatus,
  VerifyTotpEnrollmentInput,
  WebauthnCredentialSummary,
  WebauthnRegisterBeginInput,
  WebauthnRegisterBeginResult,
  WebauthnRegisterFinishInput,
  WebauthnRegisterFinishResult
} from "./types.js";

/**
 * Creates the account self-service API module for MFA management.
 *
 * Requires session authentication (`auth: { type: "session", cookie: "sid=..." }`).
 */
export const createAccountAPI = (client: ClientInstance): AccountAPI => ({
  getTotp: () => client.get<TotpStatus>("/api/account/mfa/totp"),
  enrollTotp: () => client.post<TotpEnrollmentStart>("/api/account/mfa/totp/enroll"),
  verifyTotp: (input: VerifyTotpEnrollmentInput) => client.post<TotpEnrollmentComplete>("/api/account/mfa/totp/verify", { body: input }),
  disableTotp: async () => {
    await client.delete("/api/account/mfa/totp");
  },
  listWebauthnCredentials: () => client.get<WebauthnCredentialSummary[]>("/api/account/mfa/webauthn/credentials"),
  beginWebauthnRegistration: (input?: WebauthnRegisterBeginInput) => client.post<WebauthnRegisterBeginResult>("/api/account/mfa/webauthn/register/begin", {
    body: input ?? {}
  }),
  finishWebauthnRegistration: (input: WebauthnRegisterFinishInput) => client.post<WebauthnRegisterFinishResult>("/api/account/mfa/webauthn/register/finish", { body: input }),
  removeWebauthnCredential: async (credentialId: string) => {
    await client.delete(`/api/account/mfa/webauthn/credentials/${credentialId}`);
  }
});
