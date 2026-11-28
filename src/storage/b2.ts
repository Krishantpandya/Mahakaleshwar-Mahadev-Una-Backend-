import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";

let client: S3Client | null = null;

export function isB2Configured(): boolean {
  return env.b2 !== null;
}

function getClient(): S3Client {
  if (!env.b2) {
    throw new Error("Backblaze B2 storage is not configured");
  }

  if (!client) {
    client = new S3Client({
      endpoint: env.b2.endpoint.replace(/\\/+$/, ""),
      region: env.b2.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: env.b2.keyId,
        secretAccessKey: env.b2.applicationKey
      }
    });
  }

  return client;
}

function getBucketName(): string {
  if (!env.b2) {
    throw new Error("Backblaze B2 storage is not configured");
  }
  return env.b2.bucketName;
}

function safeDispositionFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() || "photo";
  return basename
    .replace(/[\\r\\n"]/g, "")
    .replace(/[^\\x20-\\x7E]/g, "_")
    .slice(0, 150) || "photo";
}

export async function uploadMediaObject(input: {
  key: string;
  body: Buffer;
  contentType: string;
  originalFilename: string;
}): Promise<void> {
  await getClient().send(new PutObjectCommand({
    Bucket: getBucketName(),
    Key: input.key,
    Body: input.body,
    ContentLength: input.body.byteLength,
    ContentType: input.contentType,
    ContentDisposition: `inline; filename="${safeDispositionFilename(input.originalFilename)}"`,
    CacheControl: "private, max-age=300"
  }));
}

export async function createSignedMediaUrl(
  key: string,
  filename: string,
  disposition: "inline" | "attachment" = "inline"
): Promise<string> {
  const safeFilename = safeDispositionFilename(filename);
  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ResponseContentDisposition: `${disposition}; filename="${safeFilename}"`,
    ResponseCacheControl: "private, max-age=300"
  });

  return getSignedUrl(getClient(), command, {
    expiresIn: env.b2.signedUrlTtlSeconds
  });
}

export async function deleteMediaObject(key: string): Promise<void> {
  await getClient().send(new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key
  }));
}

export function closeMediaStorage(): void {
  client?.destroy();
  client = null;
}
