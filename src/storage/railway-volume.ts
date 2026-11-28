import { createReadStream, type ReadStream } from "node:fs";
import { access, mkdir, rm, stat, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { env } from "../config/env.js";

function resolveStoragePath(key: string): string {
  if (!key.startsWith("media/photos/")) {
    throw new Error("Invalid media storage key");
  }

  const segments = key.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-zA-Z0-9._-]+$/.test(segment))) {
    throw new Error("Invalid media storage key");
  }

  const root = resolve(env.mediaStorageDir);
  const destination = resolve(root, ...segments);
  const pathFromRoot = relative(root, destination);
  if (!pathFromRoot || pathFromRoot.startsWith(".." + sep) || pathFromRoot === ".." || isAbsolute(pathFromRoot)) {
    throw new Error("Media storage path escapes its configured directory");
  }
  return destination;
}

export async function uploadMediaObject(input: {
  key: string;
  body: Buffer;
}): Promise<void> {
  const destination = resolveStoragePath(input.key);
  await mkdir(resolve(destination, ".."), { recursive: true });
  await writeFile(destination, input.body, { flag: "wx", mode: 0o640 });
}

export async function deleteMediaObject(key: string): Promise<void> {
  const destination = resolveStoragePath(key);
  await rm(destination, { force: true });
}

export async function openMediaObject(key: string): Promise<{ stream: ReadStream; size: number } | null> {
  const destination = resolveStoragePath(key);
  try {
    await access(destination, constants.R_OK);
    const fileInfo = await stat(destination);
    if (!fileInfo.isFile()) return null;
    return { stream: createReadStream(destination), size: fileInfo.size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT" || (error as NodeJS.ErrnoException).code === "EACCES") {
      return null;
    }
    throw error;
  }
}
