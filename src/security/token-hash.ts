import { createHash } from "node:crypto";

export const hashOpaqueToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");
