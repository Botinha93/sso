import { z } from "zod";

const isAbsoluteHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

const isRelativeMediaPath = (value: string) => value.startsWith("/");

export const isValidImageReference = (value: string) =>
  isAbsoluteHttpUrl(value) || isRelativeMediaPath(value);

/** Accepts absolute URLs, relative paths, or null to clear a stored image reference. */
export const nullableImageUrlSchema = z
  .union([
    z.null(),
    z.string().refine((value) => value.length > 0 && isValidImageReference(value), {
      message: "Image URL must be an http(s) URL or a path starting with /"
    })
  ])
  .optional();

/** Optional image reference for create payloads (omit or provide a valid URL/path). */
export const optionalImageUrlSchema = z
  .string()
  .refine((value) => value.length > 0 && isValidImageReference(value), {
    message: "Image URL must be an http(s) URL or a path starting with /"
  })
  .optional();

export const nullableIconSchema = z.union([z.null(), z.string()]).optional();
