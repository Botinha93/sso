import { AuthorizationError } from "../core/errors.js";
import type {
  PolicyDecisionStrategy,
  User
} from "../domain/models.js";
import {
  PolicyService,
  type PolicySimulationResult
} from "./policy-service.js";

export interface AuthorizationRequest {
  user: User;
  resource: string;
  action: string;
  tenantId?: string;
  clientId?: string;
  ip?: string;
  context?: Record<string, unknown>;
  decisionStrategy?: PolicyDecisionStrategy;
}

export class AuthorizationService {
  constructor(private readonly policyService: PolicyService) {}

  async evaluate(input: AuthorizationRequest): Promise<PolicySimulationResult> {
    return this.policyService.evaluateAuthorizationPolicies({
      user: input.user,
      resource: input.resource,
      action: input.action,
      tenantId: input.tenantId,
      clientId: input.clientId,
      ip: input.ip,
      context: input.context,
      decisionStrategy: input.decisionStrategy
    });
  }

  async assertAuthorized(input: AuthorizationRequest): Promise<PolicySimulationResult> {
    const result = await this.evaluate(input);
    if (!result.allow) {
      const deniedBy = result.deniedBy.length > 0
        ? ` Denied by: ${result.deniedBy.join(", ")}.`
        : "";
      throw new AuthorizationError(`Access denied by authorization policy.${deniedBy}`);
    }
    return result;
  }
}