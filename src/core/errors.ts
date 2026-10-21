export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "Authentication failed", statusCode = 401) {
    super(message, statusCode);
    this.name = "AuthenticationError";
  }
}

/**
 * Every way a sign-in can fail, with the status it answers and a message safe
 * to show the user. The `reason` key is the stable contract clients switch on;
 * messages may change.
 *
 * Credential failures stay deliberately vague (unknown user, wrong password and
 * a passkey-less account all look alike) so the codes cannot be used to
 * enumerate accounts. Anything revealed about an account's state is only
 * revealed after its password matched.
 */
export const LOGIN_ERRORS = {
  // The request itself
  invalid_request: { status: 422, message: "Invalid request" },
  client_not_found: { status: 404, message: "Unknown client" },
  tenant_not_found: { status: 404, message: "Unknown tenant" },

  // The client registration (an operator has to fix these)
  client_secret_missing: { status: 428, message: "This application is not configured correctly. Contact your administrator." },
  grants_missing: { status: 428, message: "This application is not configured correctly. Contact your administrator." },
  allowed_scopes_missing: { status: 428, message: "This application is not configured correctly. Contact your administrator." },
  redirect_uris_missing: { status: 428, message: "This application is not configured correctly. Contact your administrator." },
  client_flow_not_allowed: { status: 403, message: "This application is not allowed to use the active sign-in flow" },
  password_login_disabled: { status: 403, message: "Password sign-in is not enabled" },

  // Credentials and account state
  invalid_credentials: { status: 401, message: "Incorrect username or password" },
  account_locked: { status: 423, message: "This account is temporarily locked" },
  account_disabled: { status: 403, message: "This account is disabled" },
  account_unavailable: { status: 401, message: "This account is no longer available" },

  // Extra steps the active flow asks for; resend the request with them
  captcha_required: { status: 400, message: "Captcha verification is required" },
  prompt_acknowledgement_required: { status: 400, message: "Interactive prompt acknowledgement is required" },
  risk_acknowledgement_required: { status: 400, message: "Additional verification required due to elevated risk" },

  // Refusals
  login_blocked_risk: { status: 403, message: "Login blocked due to elevated risk" },
  policy_denied: { status: 403, message: "Sign-in was rejected by a security policy" },
  mfa_enrollment_required: { status: 403, message: "Two-factor authentication is required for this account" },

  // Multi-step logins: tickets are single use, so any of these means start over
  mfa_ticket_invalid: { status: 401, message: "The MFA step expired or was already used. Sign in again." },
  invalid_mfa_code: { status: 401, message: "Invalid one-time code. Sign in again." },
  password_change_ticket_invalid: { status: 401, message: "The password change step expired or was already used. Sign in again." },
  password_confirmation_mismatch: { status: 422, message: "New password and confirmation do not match" },
  password_policy_violation: { status: 422, message: "The new password does not meet the password policy" },
  webauthn_not_available: { status: 401, message: "Passkey sign-in is not available for this account" },
  webauthn_transaction_invalid: { status: 401, message: "The passkey sign-in expired or was already used. Start again." },
  webauthn_credential_invalid: { status: 401, message: "This passkey is not valid for this sign-in" },
  webauthn_counter_replay: { status: 401, message: "This passkey reported a replayed signature counter" }
} as const satisfies Record<string, { status: number; message: string }>;

export type LoginErrorReason = keyof typeof LOGIN_ERRORS;

/**
 * A sign-in failure clients can act on: `reason` says what went wrong and the
 * status follows from it. Extends AuthenticationError so code that treats any
 * authentication failure alike keeps working.
 */
export class LoginError extends AuthenticationError {
  constructor(
    public readonly reason: LoginErrorReason,
    message: string = LOGIN_ERRORS[reason].message
  ) {
    super(message, LOGIN_ERRORS[reason].status);
    this.name = "LoginError";
  }
}

/**
 * Raised when the account (or unknown identifier) is under a login lockout.
 * Unlike a generic AuthenticationError, this one is safe to surface as-is so
 * users understand the rejection is temporary and not a wrong password.
 */
export class AccountLockedError extends LoginError {
  readonly lockedUntil: Date;
  readonly retryAfterSeconds: number;

  constructor(lockedUntil: Date, now: Date = new Date()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      "account_locked",
      `Too many failed sign-in attempts. This account is temporarily locked. Try again in ${minutes} ${minutes === 1 ? "minute" : "minutes"}.`
    );
    this.name = "AccountLockedError";
    this.lockedUntil = lockedUntil;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "Not authorized") {
    super(message, 403);
    this.name = "AuthorizationError";
  }
}

export class ValidationError extends AppError {
  constructor(message = "Invalid request") {
    super(message, 422);
    this.name = "ValidationError";
  }
}

export type ClientMisconfigurationReason = Extract<
  LoginErrorReason,
  "client_secret_missing" | "grants_missing" | "allowed_scopes_missing" | "redirect_uris_missing"
>;

/**
 * Raised when a sign-in targets a client whose registration is incomplete.
 * The user did nothing wrong, so this answers 428 with a `reason` the
 * operator can act on instead of a generic authentication failure.
 */
export class ClientMisconfiguredError extends LoginError {
  constructor(reason: ClientMisconfigurationReason) {
    super(reason);
    this.name = "ClientMisconfiguredError";
  }
}
