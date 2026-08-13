import type { User } from "../domain/models.js";

export type PasswordExpirationEvaluation =
  | { active: false }
  | {
    active: true;
    status: "ok";
    daysRemaining: number;
    expiresAt: Date;
    maxDays: number;
    warnDaysBefore: number;
  }
  | {
    active: true;
    status: "warning";
    daysRemaining: number;
    expiresAt: Date;
    maxDays: number;
    warnDaysBefore: number;
  }
  | {
    active: true;
    status: "expired";
    daysRemaining: 0;
    expiresAt: Date;
    maxDays: number;
    warnDaysBefore: number;
  };

export type PasswordExpirationWarning = {
  daysRemaining: number;
  expiresAt: string;
  message: string;
};

export type PasswordExpirationNotice = PasswordExpirationWarning & {
  status: "warning" | "expired";
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function passwordChangedAtTodayIso(reference = new Date()) {
  return new Date(Date.UTC(
    reference.getUTCFullYear(),
    reference.getUTCMonth(),
    reference.getUTCDate()
  )).toISOString();
}

export function resolvePasswordChangedAt(user: User) {
  const changedAtRaw = user.customAttributes.password_changed_at?.trim();
  return changedAtRaw ? new Date(changedAtRaw) : new Date(passwordChangedAtTodayIso());
}

export function evaluatePasswordExpiration(input: {
  user: User;
  config: Record<string, unknown>;
}): PasswordExpirationEvaluation {
  const maxDays = Number(input.config.days ?? 0);
  if (!Number.isFinite(maxDays) || maxDays <= 0) {
    return { active: false };
  }

  const warnDaysBefore = Math.max(0, Number(input.config.warnDaysBefore ?? 14));
  const baseline = resolvePasswordChangedAt(input.user);
  const expiresAt = new Date(baseline.getTime() + maxDays * MS_PER_DAY);
  const millisRemaining = expiresAt.getTime() - Date.now();
  const daysRemaining = Math.max(0, Math.ceil(millisRemaining / MS_PER_DAY));

  if (millisRemaining <= 0) {
    return {
      active: true,
      status: "expired",
      daysRemaining: 0,
      expiresAt,
      maxDays,
      warnDaysBefore
    };
  }

  if (daysRemaining <= warnDaysBefore) {
    return {
      active: true,
      status: "warning",
      daysRemaining,
      expiresAt,
      maxDays,
      warnDaysBefore
    };
  }

  return {
    active: true,
    status: "ok",
    daysRemaining,
    expiresAt,
    maxDays,
    warnDaysBefore
  };
}

export function buildPasswordExpirationWarning(evaluation: Extract<PasswordExpirationEvaluation, { active: true; status: "warning" }>): PasswordExpirationWarning {
  const dayLabel = evaluation.daysRemaining === 1 ? "day" : "days";
  return {
    daysRemaining: evaluation.daysRemaining,
    expiresAt: evaluation.expiresAt.toISOString(),
    message: `Your password expires in ${evaluation.daysRemaining} ${dayLabel}. Please change it soon.`
  };
}

export function buildPasswordExpirationNotice(evaluation: PasswordExpirationEvaluation): PasswordExpirationNotice | undefined {
  if (!evaluation.active) {
    return undefined;
  }

  if (evaluation.status === "expired") {
    return {
      status: "expired",
      daysRemaining: 0,
      expiresAt: evaluation.expiresAt.toISOString(),
      message: "Your password has expired. Choose a new password to continue signing in."
    };
  }

  if (evaluation.status === "warning") {
    return {
      status: "warning",
      ...buildPasswordExpirationWarning(evaluation)
    };
  }

  return undefined;
}
