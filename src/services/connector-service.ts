import { nanoid } from "nanoid";
import type { Connector, ConnectorRun, ConnectorMapping, ConnectorType, ConnectorStatus } from "../domain/models.js";
import type { ConnectorRepository, ConnectorRunRepository, ConnectorMappingRepository, AuthMetricRepository } from "../repositories/contracts.js";
import type { AuditRepository } from "../repositories/contracts.js";

type ConnectorConfig = {
  retryMaxAttempts?: number;
  retryBackoffMs?: number;
  deadLetterQueue?: string;
  simulateFailureCount?: number;
  simulateImportedRecords?: number;
};

type EventEmitterLike = {
  emit: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
};

export class ConnectorService {
  constructor(
    private readonly connectorRepository: ConnectorRepository,
    private readonly connectorRunRepository: ConnectorRunRepository,
    private readonly connectorMappingRepository: ConnectorMappingRepository,
    private readonly auditRepository: AuditRepository,
    private readonly eventEmitter?: EventEmitterLike
  ) {}

  async listConnectors(): Promise<Connector[]> {
    return this.connectorRepository.list();
  }

  async getConnector(id: string): Promise<Connector | undefined> {
    return this.connectorRepository.findById(id);
  }

  async createConnector(input: {
    name: string;
    type: ConnectorType;
    config: Record<string, unknown>;
    schedule?: string;
  }): Promise<Connector> {
    const connector = await this.connectorRepository.create({
      name: input.name,
      type: input.type,
      status: "active",
      config: input.config,
      schedule: input.schedule
    });
    await this.auditRepository.log({
      type: "connector_created",
      actorType: "system",
      metadata: { name: connector.name, type: connector.type }
    });
    return connector;
  }

  async updateConnector(id: string, input: Partial<{
    name: string;
    type: ConnectorType;
    status: ConnectorStatus;
    config: Record<string, unknown>;
    schedule: string;
  }>): Promise<Connector | undefined> {
    const updated = await this.connectorRepository.update(id, input);
    if (updated) {
      await this.auditRepository.log({
        type: "connector_updated",
        actorType: "system",
        metadata: { connectorId: id, changes: Object.keys(input) }
      });
    }
    return updated;
  }

  async deleteConnector(id: string): Promise<void> {
    const mappings = await this.connectorMappingRepository.listByConnector(id);
    for (const m of mappings) {
      await this.connectorMappingRepository.delete(m.id);
    }
    await this.connectorRunRepository.deleteByConnector(id);
    await this.connectorRepository.delete(id);
    await this.auditRepository.log({
      type: "connector_deleted",
      actorType: "system",
      metadata: { connectorId: id }
    });
  }

  async triggerSync(id: string): Promise<ConnectorRun> {
    const connector = await this.connectorRepository.findById(id);
    if (!connector) throw new Error("Connector not found");
    if (connector.status !== "active") throw new Error("Connector is not active");

    const config = this.getSyncConfig(connector.config);
    const maxAttempts = Math.max(1, Math.min(10, Math.trunc(config.retryMaxAttempts ?? 3)));
    const baseBackoffMs = Math.max(0, Math.min(60_000, Math.trunc(config.retryBackoffMs ?? 100)));
    const simulatedFailureCount = Math.max(0, Math.trunc(config.simulateFailureCount ?? 0));
    const simulatedImportedRecords = Math.max(0, Math.trunc(config.simulateImportedRecords ?? 0));
    const deadLetterQueue = String(config.deadLetterQueue ?? `connector:${id}:dead-letter`);

    const run = await this.connectorRunRepository.create({
      connectorId: id,
      status: "pending",
      recordsImported: 0,
      recordsFailed: 0
    });

    const started = await this.connectorRunRepository.update(run.id, {
      status: "running",
      startedAt: new Date()
    });

    await this.auditRepository.log({
      type: "connector_sync_triggered",
      actorType: "system",
      metadata: { connectorId: id, runId: run.id, maxAttempts, baseBackoffMs }
    });

    let lastError = "";
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      const shouldFailThisAttempt = attempt <= simulatedFailureCount;

      if (!shouldFailThisAttempt) {
        const succeeded = await this.connectorRunRepository.update(run.id, {
          status: "succeeded",
          finishedAt: new Date(),
          recordsImported: simulatedImportedRecords,
          recordsFailed: 0,
          errorMessage: undefined
        });

        await this.connectorRepository.update(id, { lastSyncAt: new Date() });
        await this.auditRepository.log({
          type: "connector_sync_succeeded",
          actorType: "system",
          metadata: { connectorId: id, runId: run.id, attempts: attempt, recordsImported: simulatedImportedRecords }
        });

        return succeeded ?? started ?? run;
      }

      lastError = `Simulated sync failure on attempt ${attempt}`;

      if (attempt < maxAttempts) {
        const backoffMs = baseBackoffMs * Math.pow(2, attempt - 1);
        await this.connectorRunRepository.update(run.id, {
          status: "running",
          recordsFailed: attempt,
          errorMessage: `${lastError}; retrying in ${backoffMs}ms`
        });

        await this.auditRepository.log({
          type: "connector_sync_retry_scheduled",
          actorType: "system",
          metadata: { connectorId: id, runId: run.id, attempt, backoffMs }
        });

        await this.sleep(Math.min(backoffMs, 25));
      }
    }

    const deadLetterRef = `${deadLetterQueue}/${run.id}`;
    const failed = await this.connectorRunRepository.update(run.id, {
      status: "failed",
      finishedAt: new Date(),
      recordsImported: 0,
      recordsFailed: maxAttempts,
      errorMessage: `${lastError}; dead-lettered to ${deadLetterRef}`
    });

    await this.connectorRepository.update(id, { status: "error" });

    await this.auditRepository.log({
      type: "connector_sync_failed",
      actorType: "system",
      metadata: {
        connectorId: id,
        runId: run.id,
        attempts: maxAttempts,
        deadLetterRef,
        error: lastError
      }
    });

    if (this.eventEmitter) {
      await this.eventEmitter.emit("connector.sync.failed", {
        connectorId: id,
        runId: run.id,
        attempts: maxAttempts,
        deadLetterRef,
        error: lastError
      });
    }

    return failed ?? started ?? run;
  }

  async listRuns(connectorId: string, limit?: number): Promise<ConnectorRun[]> {
    return this.connectorRunRepository.listByConnector(connectorId, limit);
  }

  async listMappings(connectorId: string): Promise<ConnectorMapping[]> {
    return this.connectorMappingRepository.listByConnector(connectorId);
  }

  async createMapping(connectorId: string, input: {
    sourceField: string;
    targetField: string;
    transform?: string;
  }): Promise<ConnectorMapping> {
    return this.connectorMappingRepository.create({
      connectorId,
      sourceField: input.sourceField,
      targetField: input.targetField,
      transform: input.transform
    });
  }

  async deleteMapping(id: string): Promise<void> {
    return this.connectorMappingRepository.delete(id);
  }

  private getSyncConfig(config: Record<string, unknown>): ConnectorConfig {
    return {
      retryMaxAttempts: typeof config.retryMaxAttempts === "number" ? config.retryMaxAttempts : undefined,
      retryBackoffMs: typeof config.retryBackoffMs === "number" ? config.retryBackoffMs : undefined,
      deadLetterQueue: typeof config.deadLetterQueue === "string" ? config.deadLetterQueue : undefined,
      simulateFailureCount: typeof config.simulateFailureCount === "number" ? config.simulateFailureCount : undefined,
      simulateImportedRecords: typeof config.simulateImportedRecords === "number" ? config.simulateImportedRecords : undefined
    };
  }

  private async sleep(ms: number): Promise<void> {
    if (ms <= 0) return;
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export class AuthMetricsService {
  constructor(private readonly authMetricRepository: AuthMetricRepository) {}

  private currentBucket(): string {
    const now = new Date();
    return `${now.toISOString().slice(0, 13)}`;
  }

  async record(event: string, by = 1): Promise<void> {
    await this.authMetricRepository.increment(this.currentBucket(), event, by);
  }

  async query(input: {
    startHour?: string;
    endHour?: string;
    event?: string;
  }) {
    const end = input.endHour ?? this.currentBucket();
    const start = input.startHour ?? `${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 13)}`;
    return this.authMetricRepository.query({ startBucket: start, endBucket: end, event: input.event });
  }
}
