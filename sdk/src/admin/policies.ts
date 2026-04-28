import type { ClientInstance } from "../core/types.js";
import type {
  CreatePolicyInput,
  PoliciesAPI,
  PolicyDecisionsListQuery,
  PolicyEvaluateInput,
  PolicyListQuery,
  RemovePolicyAssignmentInput,
  SDKPolicyDecisionLog,
  SDKPolicyDefinition,
  SetPolicyAssignmentInput,
  UpdatePolicyInput
} from "./types.js";
import { applyPagination, applyTextFilter } from "../core/list-helpers.js";

/**
 * Creates the Policies admin API module.
 *
 * Supports policy CRUD, assignments, decision logs, and evaluation.
 */
export const createPoliciesAPI = (client: ClientInstance): PoliciesAPI => ({
  list: async (query?: PolicyListQuery) => {
    const policies = await client.get<SDKPolicyDefinition[]>("/api/admin/policies");
    const bySearch = applyTextFilter(policies, query?.search, [
      (item) => item.name,
      (item) => item.description
    ]);
    return applyPagination(bySearch, query);
  },
  create: (input: CreatePolicyInput) => client.post<SDKPolicyDefinition>("/api/admin/policies", { body: input }),
  update: (id: string, input: UpdatePolicyInput) => client.put<SDKPolicyDefinition>(`/api/admin/policies/${id}`, { body: input }),
  delete: async (id: string) => {
    await client.delete(`/api/admin/policies/${id}`);
  },
  setAssignment: async (id: string, input: SetPolicyAssignmentInput) => {
    await client.put(`/api/admin/policies/${id}/assignments`, { body: input });
  },
  removeAssignment: async (id: string, input: RemovePolicyAssignmentInput) => {
    await client.delete(`/api/admin/policies/${id}/assignments`, { body: input });
  },
  evaluate: (input: PolicyEvaluateInput) => client.post<unknown>("/api/admin/policies/evaluate", { body: input }),
  decisions: (query?: PolicyDecisionsListQuery) => client.get<SDKPolicyDecisionLog[]>("/api/admin/policies/decisions", { query })
});
