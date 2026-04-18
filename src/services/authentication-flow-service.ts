import { nanoid } from "nanoid";
import { ValidationError } from "../core/errors.js";
import type { AuthenticationStage, AuthenticationStageType, FlowDesignation, GrantType } from "../domain/models.js";
import type { AuthenticationFlowRepository } from "../repositories/contracts.js";

const VALID_STAGE_TYPES: AuthenticationStageType[] = [
  "password",
  "federation",
  "consent",
  "mfa_totp",
  "risk_check",
  "identification",
  "email_verification",
  "captcha",
  "prompt",
  "user_write",
  "user_login",
  "user_logout"
];
const VALID_GRANT_TYPES: GrantType[] = ["authorization_code", "client_credentials", "refresh_token", "password", "device_code"];
const VALID_DESIGNATIONS: FlowDesignation[] = [
  "authentication",
  "authorization",
  "enrollment",
  "invalidation",
  "recovery",
  "stage_configuration",
  "unenrollment"
];

const DEFAULT_ENABLED_STAGES: AuthenticationStageType[] = ["password", "federation", "consent"];
const DEFAULT_ENABLED_STAGES_BY_DESIGNATION: Partial<Record<FlowDesignation, AuthenticationStageType[]>> = {
  authentication: DEFAULT_ENABLED_STAGES,
  enrollment: ["prompt", "user_write"],
  recovery: ["identification", "user_write"],
  invalidation: ["user_logout"]
};

export class AuthenticationFlowService {
  constructor(private readonly authenticationFlowRepository: AuthenticationFlowRepository) {}

  async listFlows() {
    return this.authenticationFlowRepository.list();
  }

  async getActiveFlow() {
    return this.getActiveFlowByDesignation("authentication");
  }

  async getActiveFlowByDesignation(designation: FlowDesignation) {
    return (await this.authenticationFlowRepository.list()).find((flow) => flow.enabled && flow.designation === designation);
  }

  async assertGrantSupported(grantType: GrantType) {
    const activeFlow = await this.getActiveFlow();
    if (!activeFlow) {
      return;
    }

    if (!activeFlow.grantTypes.includes(grantType)) {
      throw new ValidationError(`Active authentication flow does not support grant type: ${grantType}`);
    }
  }

  async isStageEnabled(stageType: AuthenticationStageType): Promise<boolean> {
    return this.isStageEnabledForDesignation("authentication", stageType);
  }

  async isStageEnabledForDesignation(designation: FlowDesignation, stageType: AuthenticationStageType): Promise<boolean> {
    const activeFlow = await this.getActiveFlowByDesignation(designation);
    if (!activeFlow) {
      const defaults = DEFAULT_ENABLED_STAGES_BY_DESIGNATION[designation] ?? [];
      return defaults.includes(stageType);
    }

    return activeFlow.stages.some((stage) => stage.type === stageType && stage.required);
  }

  async assertStageEnabled(stageType: AuthenticationStageType) {
    await this.assertStageEnabledForDesignation("authentication", stageType);
  }

  async assertStageEnabledForDesignation(designation: FlowDesignation, stageType: AuthenticationStageType) {
    if (!await this.isStageEnabledForDesignation(designation, stageType)) {
      throw new ValidationError(`Authentication stage \"${stageType}\" is not enabled in active flow`);
    }
  }

  async createFlow(input: {
    name: string;
    description: string;
    designation: FlowDesignation;
    enabled: boolean;
    grantTypes: GrantType[];
    stages: AuthenticationStage[];
  }) {
    const stages = this.normalizeStages(input.stages);
    const grantTypes = this.normalizeGrantTypes(input.grantTypes);
    const designation = this.normalizeDesignation(input.designation);

    if (input.enabled && designation === "authentication") {
      await this.disableAllFlows("authentication");
    }

    return this.authenticationFlowRepository.create({
      id: nanoid(),
      name: input.name,
      description: input.description,
      designation,
      enabled: input.enabled,
      grantTypes,
      stages
    });
  }

  async updateFlow(
    id: string,
    input: {
      name?: string;
      description?: string;
      designation?: FlowDesignation;
      enabled?: boolean;
      grantTypes?: GrantType[];
      stages?: AuthenticationStage[];
    }
  ) {
    const existing = await this.authenticationFlowRepository.findById(id);
    if (!existing) {
      throw new ValidationError("Authentication flow not found");
    }

    const designation = input.designation ? this.normalizeDesignation(input.designation) : existing.designation;

    if (input.enabled && designation === "authentication") {
      await this.disableAllFlows("authentication", id);
    }

    const stages = input.stages ? this.normalizeStages(input.stages) : existing.stages;
    const grantTypes = input.grantTypes ? this.normalizeGrantTypes(input.grantTypes) : existing.grantTypes;

    const updated = this.authenticationFlowRepository.update(id, {
      name: input.name,
      description: input.description,
      designation,
      enabled: input.enabled,
      grantTypes,
      stages
    });

    if (!updated) {
      throw new ValidationError("Failed to update authentication flow");
    }

    return updated;
  }

  async deleteFlow(id: string) {
    await this.authenticationFlowRepository.delete(id);
  }

  private async disableAllFlows(designation: FlowDesignation, exceptId?: string) {
    for (const flow of await this.authenticationFlowRepository.list()) {
      if (flow.designation !== designation) {
        continue;
      }
      if (flow.id === exceptId) {
        continue;
      }

      if (flow.enabled) {
        await this.authenticationFlowRepository.update(flow.id, { enabled: false });
      }
    }
  }

  private normalizeStages(stages: AuthenticationStage[]): AuthenticationStage[] {
    if (!Array.isArray(stages) || stages.length === 0) {
      throw new ValidationError("Authentication flow must include at least one stage");
    }

    const seen = new Set<AuthenticationStageType>();
    const sorted = [...stages].sort((a, b) => a.order - b.order);

    for (const stage of sorted) {
      if (!VALID_STAGE_TYPES.includes(stage.type)) {
        throw new ValidationError(`Unsupported stage type: ${stage.type}`);
      }
      if (seen.has(stage.type)) {
        throw new ValidationError(`Duplicate stage type in flow: ${stage.type}`);
      }
      if (!Number.isInteger(stage.order) || stage.order < 1) {
        throw new ValidationError("Stage order must be a positive integer");
      }
      seen.add(stage.type);
    }

    return sorted;
  }

  private normalizeGrantTypes(grantTypes: GrantType[]): GrantType[] {
    if (!Array.isArray(grantTypes) || grantTypes.length === 0) {
      throw new ValidationError("Authentication flow must include at least one grant type");
    }

    const unique = Array.from(new Set(grantTypes));
    for (const grantType of unique) {
      if (!VALID_GRANT_TYPES.includes(grantType)) {
        throw new ValidationError(`Unsupported grant type: ${grantType}`);
      }
    }

    return unique;
  }

  private normalizeDesignation(designation: FlowDesignation): FlowDesignation {
    if (!VALID_DESIGNATIONS.includes(designation)) {
      throw new ValidationError(`Unsupported flow designation: ${designation}`);
    }
    return designation;
  }
}
