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
  constructor(message = "Authentication failed") {
    super(message, 401);
    this.name = "AuthenticationError";
  }
}

/**
 * Raised when the account (or unknown identifier) is under a login lockout.
 * Unlike a generic AuthenticationError, this one is safe to surface as-is so
 * users understand the rejection is temporary and not a wrong password.
 */
export class AccountLockedError extends AuthenticationError {
  readonly lockedUntil: Date;
  readonly retryAfterSeconds: number;

  constructor(lockedUntil: Date, now: Date = new Date()) {
    const retryAfterSeconds = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 1000));
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
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
