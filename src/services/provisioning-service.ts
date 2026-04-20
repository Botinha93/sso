import type {
  GroupRepository,
  ProvisioningJobRepository,
  ProvisioningMappingRepository,
  UserRepository
} from "../repositories/contracts.js";

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

    const summary = {
      dryRun: input.dryRun,
      usersEvaluated: users.length,
      groupsEvaluated: groups.length,
      mappingsApplied: mappings.filter((mapping) => mapping.enabled).length,
      driftDetected: 0,
      updatedUsers: 0,
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
