import type { AuditEvent, AuditEventType } from "../../domain/models.js";

export interface AdminRiskEvent {
  id: string;
  sourceType: AuditEventType;
  severity: "medium" | "high" | "critical";
  title: string;
  createdAt: Date;
  actorId?: string;
  ip?: string;
  metadata?: Record<string, unknown>;
}

const RISK_EVENT_CATALOG: Partial<Record<AuditEventType, { severity: AdminRiskEvent["severity"]; title: string }>> = {
  login_failed: { severity: "medium", title: "Failed login attempt" },
  account_lockout: { severity: "high", title: "Account lockout triggered" },
  session_anomaly_detected: { severity: "high", title: "Session anomaly detected" },
  security_rate_limit_blocked: { severity: "medium", title: "Rate limit protection blocked a request" },
  security_sqli_blocked: { severity: "critical", title: "SQL injection pattern blocked" },
  saml_assertion_invalid: { severity: "high", title: "Invalid SAML assertion received" },
  elevation_break_glass_activated: { severity: "critical", title: "Emergency break-glass elevation activated" }
};

export const deriveRiskEventsFromAudit = (events: AuditEvent[], limit: number): AdminRiskEvent[] => {
  const normalizedLimit = Math.max(1, Math.min(limit, 200));

  const derived: AdminRiskEvent[] = [];

  for (const event of events) {
    const riskDescriptor = RISK_EVENT_CATALOG[event.type];
    if (!riskDescriptor) {
      continue;
    }

    derived.push({
      id: event.id,
      sourceType: event.type,
      severity: riskDescriptor.severity,
      title: riskDescriptor.title,
      createdAt: event.createdAt,
      actorId: event.actorId,
      ip: event.ip,
      metadata: event.metadata
    });

    if (derived.length >= normalizedLimit) {
      break;
    }
  }

  return derived;
};
