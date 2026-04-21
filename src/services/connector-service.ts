import { nanoid } from "nanoid";
import type { Connector, ConnectorRun, ConnectorMapping, ConnectorType, ConnectorStatus } from "../domain/models.js";
import type { ConnectorRepository, ConnectorRunRepository, ConnectorMappingRepository, AuthMetricRepository } from "../repositories/contracts.js";
import type { AuditRepository } from "../repositories/contracts.js";

export class ConnectorService {
  constructor(
    private readonly connectorRepository: ConnectorRepository,
    private readonly connectorRunRepository: ConnectorRunRepository,
    private readonly connectorMappingRepository: ConnectorMappingRepository,
    private readonly auditRepository: AuditRepository
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

    const run = await this.connectorRunRepository.create({
      connectorId: id,
      status: "pending",
      recordsImported: 0,
      recordsFailed: 0
    });

    // Mark as running immediately; real execution would be async
    const started = await this.connectorRunRepository.update(run.id, {
      status: "running",
      startedAt: new Date()
    });

    // Simulate sync completion (in production this would be a background job)
    const finished = await this.connectorRunRepository.update(run.id, {
      status: "succeeded",
      finishedAt: new Date(),
      recordsImported: 0,
      recordsFailed: 0
    });

    await this.connectorRepository.update(id, { lastSyncAt: new Date() });

    await this.auditRepository.log({
      type: "connector_sync_triggered",
      actorType: "system",
      metadata: { connectorId: id, runId: run.id }
    });

    return finished ?? started ?? run;
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
