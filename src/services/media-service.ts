import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { dirname, extname, join, resolve } from "node:path";
import { nanoid } from "nanoid";

const MIME_TO_EXTENSION: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg"
};

const EXTENSION_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml"
};

export interface UploadedMedia {
  url: string;
  relativePath: string;
}

export interface DefaultMediaOption {
  key: string;
  label: string;
  url: string;
}

export class MediaService {
  private readonly uploadsRoot: string;

  constructor(storageRoot: string) {
    this.uploadsRoot = resolve(storageRoot);
  }

  private async ensureDirectoryFor(filePath: string) {
    await mkdir(dirname(filePath), { recursive: true });
  }

  resolveUploadPath(relativePath: string) {
    const normalized = relativePath.replace(/^\/+/, "");
    const filePath = resolve(this.uploadsRoot, normalized);
    if (!filePath.startsWith(this.uploadsRoot)) {
      throw new Error("Invalid media path");
    }
    return filePath;
  }

  getMimeTypeForPath(relativePath: string) {
    return EXTENSION_TO_MIME[extname(relativePath).toLowerCase()] ?? "application/octet-stream";
  }

  async readUploaded(relativePath: string) {
    const filePath = this.resolveUploadPath(relativePath);
    const data = await readFile(filePath);
    return {
      data,
      mimeType: this.getMimeTypeForPath(relativePath)
    };
  }

  async saveUploadedImage(input: {
    bucket: "users" | "apps" | "suggestions";
    ownerId: string;
    bytes: Buffer;
    mimeType: string;
  }): Promise<UploadedMedia> {
    const extension = MIME_TO_EXTENSION[input.mimeType];
    if (!extension) {
      throw new Error("Unsupported media type");
    }

    const filename = `${Date.now()}_${nanoid(8)}${extension}`;
    const relativePath = join(input.bucket, input.ownerId, filename).replaceAll("\\", "/");
    const absolutePath = this.resolveUploadPath(relativePath);
    await this.ensureDirectoryFor(absolutePath);
    await writeFile(absolutePath, input.bytes);

    return {
      url: `/media/uploads/${relativePath}`,
      relativePath
    };
  }

  async deleteByUrl(url?: string | null) {
    if (!url || !url.startsWith("/media/uploads/")) {
      return;
    }

    const relativePath = url.slice("/media/uploads/".length);
    if (!relativePath) {
      return;
    }

    const absolutePath = this.resolveUploadPath(relativePath);
    await unlink(absolutePath).catch(() => undefined);
  }

  listDefaultUserAvatars(initials = "AB"): DefaultMediaOption[] {
    const encodedInitials = encodeURIComponent(initials.slice(0, 3) || "AB");
    return [
      { key: "initials", label: "Initials", url: `/media/defaults/user/initials.svg?text=${encodedInitials}` },
      { key: "male", label: "Male Outline", url: "/media/defaults/user/male.svg" },
      { key: "female", label: "Female Outline", url: "/media/defaults/user/female.svg" },
      { key: "rocket", label: "Rocket", url: "/media/defaults/user/rocket.svg" },
      { key: "house", label: "House", url: "/media/defaults/user/house.svg" },
      { key: "dog", label: "Dog", url: "/media/defaults/user/dog.svg" },
      { key: "cat", label: "Cat", url: "/media/defaults/user/cat.svg" },
      { key: "sunset", label: "Sunset", url: "/media/defaults/user/sunset.svg" },
      { key: "forest", label: "Forest", url: "/media/defaults/user/forest.svg" },
      { key: "ocean", label: "Ocean", url: "/media/defaults/user/ocean.svg" },
      { key: "mono", label: "Monochrome", url: "/media/defaults/user/mono.svg" }
    ];
  }

  listDefaultAppImages(): DefaultMediaOption[] {
    return [
      { key: "grid", label: "Grid", url: "/media/defaults/app/grid.svg" },
      { key: "bolt", label: "Bolt", url: "/media/defaults/app/bolt.svg" },
      { key: "shield", label: "Shield", url: "/media/defaults/app/shield.svg" },
      { key: "orbit", label: "Orbit", url: "/media/defaults/app/orbit.svg" }
    ];
  }
}
