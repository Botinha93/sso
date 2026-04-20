import type {
  GroupRepository,
  ProvisioningJobRepository,
  ProvisioningMappingRepository,
  UserRepository
} from "../repositories/contracts.js";
import { evaluateProvisioningMappings } from "./provisioning-mapping-engine.js";

export class ProvisioningService {
  constructor(
    private readonly provisioningMappingRepository: ProvisioningMappingRepository,
    private readonly provisioningJobRepository: ProvisioningJobRepository,
    private readonly userRepository: UserRepository,
    private readonly groupRepository: GroupRepository
  ) {}

  async listMappings() {
    return this.provisioningMappingRepository.list();
  }

  async createMapping(input: {
    name: string;
    sourceAttribute: string;
    targetAttribute: string;
    transformExpression?: string;
    enabled: boolean;
  }) {
    return this.provisioningMappingRepository.create(input);
  }

  async deleteMapping(id: string) {
    await this.provisioningMappingRepository.delete(id);
  }

  async runReconcile(input: { initiatedByUserId?: string; dryRun: boolean }) {
    const users = await this.userRepository.list();
    const groups = await this.groupRepository.list();
    const mappings = await this.provisioningMappingRepository.list();
    const enabledMappings = mappings.filter((mapping) => mapping.enabled);

    let driftDetected = 0;
    let updatedUsers = 0;

    for (const user of users) {
      const evaluation = evaluateProvisioningMappings({
        customAttributes: user.customAttributes,
        mappings
      });

      if (evaluation.drift.length === 0) {
        continue;
      }

      driftDetected += evaluation.drift.length;

      if (!input.dryRun) {
        await this.userRepository.setCustomAttributes(user.id, evaluation.nextCustomAttributes);
        updatedUsers += 1;
      }
    }

    const summary = {
      dryRun: input.dryRun,
      usersEvaluated: users.length,
      groupsEvaluated: groups.length,
      mappingsApplied: enabledMappings.length,
      driftDetected,
      updatedUsers,
      updatedGroups: 0
    };

    const runningJob = await this.provisioningJobRepository.create({
      jobType: "reconcile",
      status: "running",
      summary: {},
      initiatedByUserId: input.initiatedByUserId
    });

    const completed = await this.provisioningJobRepository.update(runningJob.id, {
      status: "completed",
      summary,
      completedAt: new Date()
    });

    return completed ?? { ...runningJob, status: "completed", summary, completedAt: new Date() };
  }

  async listJobs(limit = 20) {
    return this.provisioningJobRepository.list(limit);
  }
}
