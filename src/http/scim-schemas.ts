import { z } from "zod";

export const scimListQuerySchema = z.object({
  startIndex: z.coerce.number().int().min(1).optional(),
  count: z.coerce.number().int().min(1).max(200).optional(),
  filter: z.string().min(1).optional()
});

export const scimUserNameSchema = z.object({
  givenName: z.string().min(1).optional(),
  familyName: z.string().min(1).optional()
}).optional();

export const scimUserEmailSchema = z.object({
  value: z.string().email(),
  primary: z.boolean().optional()
});

export const scimCreateUserSchema = z.object({
  schemas: z.array(z.string()).optional(),
  externalId: z.string().min(1).optional(),
  userName: z.string().min(1),
  name: scimUserNameSchema,
  emails: z.array(scimUserEmailSchema).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional()
});

export const scimReplaceUserSchema = z.object({
  schemas: z.array(z.string()).optional(),
  externalId: z.string().min(1).optional(),
  userName: z.string().min(1),
  name: scimUserNameSchema,
  emails: z.array(scimUserEmailSchema).optional(),
  active: z.boolean().optional(),
  password: z.string().min(8).optional()
});

export const scimPatchOperationSchema = z.object({
  op: z.enum(["add", "replace", "remove"]),
  path: z.string().optional(),
  value: z.unknown().optional()
});

export const scimPatchSchema = z.object({
  schemas: z.array(z.string()).optional(),
  Operations: z.array(scimPatchOperationSchema).min(1)
});

export const scimGroupMemberSchema = z.object({
  value: z.string().min(1)
});

export const scimCreateGroupSchema = z.object({
  schemas: z.array(z.string()).optional(),
  externalId: z.string().min(1).optional(),
  displayName: z.string().min(1),
  members: z.array(scimGroupMemberSchema).optional()
});

export const scimReplaceGroupSchema = z.object({
  schemas: z.array(z.string()).optional(),
  externalId: z.string().min(1).optional(),
  displayName: z.string().min(1),
  members: z.array(scimGroupMemberSchema).optional()
});
