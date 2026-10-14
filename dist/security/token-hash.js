import { createHash } from "node:crypto";
export const hashOpaqueToken = (token) => createHash("sha256").update(token).digest("hex");
