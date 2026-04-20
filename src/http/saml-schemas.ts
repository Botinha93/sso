import { z } from "zod";

export const createServiceProviderSchema = z.object({
  entityId: z.string().min(1, "Entity ID is required"),
  acsUrl: z.string().url("ACS URL must be a valid URL"),
  sloUrl: z.string().url("SLO URL must be a valid URL").optional(),
  signingCertificate: z.string().min(1, "Signing certificate is required"),
  encryptionCertificate: z.string().optional(),
  nameIdFormat: z.enum(["persistent", "transient", "emailAddress"]).default("persistent"),
  enabled: z.boolean().default(true),
});

export type CreateServiceProviderInput = z.infer<typeof createServiceProviderSchema>;

export const updateServiceProviderSchema = z.object({
  entityId: z.string().min(1).optional(),
  acsUrl: z.string().url().optional(),
  sloUrl: z.string().url().optional(),
  signingCertificate: z.string().min(1).optional(),
  encryptionCertificate: z.string().optional(),
  nameIdFormat: z.enum(["persistent", "transient", "emailAddress"]).optional(),
  enabled: z.boolean().optional(),
});

export type UpdateServiceProviderInput = z.infer<typeof updateServiceProviderSchema>;

export const listServiceProvidersSchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  enabled: z.string().optional(), // "true" or "false"
});

export type ListServiceProvidersQuery = z.infer<typeof listServiceProvidersSchema>;

export const setNameIdMappingSchema = z.object({
  format: z.enum(["persistent", "transient", "emailAddress"]),
  sourceAttribute: z.string().min(1, "Source attribute is required"),
});

export type SetNameIdMappingInput = z.infer<typeof setNameIdMappingSchema>;

export const listAssertionAuditsSchema = z.object({
  spId: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

export type ListAssertionAuditsQuery = z.infer<typeof listAssertionAuditsSchema>;
