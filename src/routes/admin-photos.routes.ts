import { randomUUID } from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { database } from "../database.js";
import { env } from "../config/env.js";
import { requireAdmin } from "./admin-auth.routes.js";
import { deleteMediaObject, uploadMediaObject } from "../storage/railway-volume.js";

const allowedImageTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif"
]);

const uploadFieldsSchema = z.object({
  caption: z.string().trim().max(1000).optional(),
  photoDate: z.string().date().optional(),
  takenAt: z.string().datetime({ offset: true }).optional()
});

function safeObjectFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() || "photo";
  const safe = basename
    .normalize("NFKC")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^\.+/, "")
    .slice(0, 120);
  return safe || "photo";
}

function hasValidImageSignature(buffer: Buffer, contentType: string): boolean {
  switch (contentType) {
    case "image/jpeg":
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    case "image/png":
      return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/webp":
      return buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
    case "image/avif":
      return buffer.length >= 12 && buffer.toString("ascii", 4, 8) === "ftyp" &&
        (buffer.includes(Buffer.from("avif")) || buffer.includes(Buffer.from("avis")));
    default:
      return false;
  }
}

export const adminPhotoRoutes: FastifyPluginAsync = async (app) => {
  app.post("/", {
    preHandler: requireAdmin,
    config: { rateLimit: { max: 10, timeWindow: "1 hour" } }
  }, async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }
    if (!request.isMultipart()) {
      return reply.code(415).send({ error: "Upload must use multipart/form-data" });
    }

    let imageBuffer: Buffer | null = null;
    let originalFilename = "photo";
    let contentType = "";
    const fields: Record<string, string> = {};

    try {
      for await (const part of request.parts()) {
        if (part.type === "file") {
          if (imageBuffer) {
            return reply.code(400).send({ error: "Only one image file is allowed" });
          }
          if (!allowedImageTypes.has(part.mimetype)) {
            return reply.code(415).send({ error: "Unsupported image type. Use JPEG, PNG, WebP, or AVIF." });
          }

          originalFilename = part.filename || "photo";
          contentType = part.mimetype;
          imageBuffer = await part.toBuffer();
          if (part.file.truncated) {
            return reply.code(413).send({ error: "Image exceeds the upload size limit" });
          }
        } else {
          fields[part.fieldname] = String(part.value);
        }
      }
    } catch (error) {
      const errorCode = (error as { code?: string }).code;
      if (errorCode === "FST_REQ_FILE_TOO_LARGE") {
        return reply.code(413).send({ error: "Image exceeds the upload size limit" });
      }
      throw error;
    }

    if (!imageBuffer || imageBuffer.byteLength === 0) {
      return reply.code(400).send({ error: "A non-empty image file is required" });
    }
    if (imageBuffer.byteLength > env.maxUploadBytes) {
      return reply.code(413).send({ error: "Image exceeds the upload size limit" });
    }
    if (!hasValidImageSignature(imageBuffer, contentType)) {
      return reply.code(415).send({ error: "The uploaded file content does not match its image type" });
    }

    const parsedFields = uploadFieldsSchema.safeParse(fields);
    if (!parsedFields.success) {
      return reply.code(400).send({
        error: "Invalid photo metadata",
        details: parsedFields.error.flatten()
      });
    }

    const photoId = randomUUID();
    const storedFilename = safeObjectFilename(originalFilename);
    const storageKey = `media/photos/${photoId}/${storedFilename}`;

    await uploadMediaObject({
      key: storageKey,
      body: imageBuffer
    });

    try {
      const result = await database.query(
        "INSERT INTO photos (id, storage_key, media_url, mime_type, file_size_bytes, caption, taken_at, photo_date, original_filename, published_at, created_by_admin_id) " +
        "VALUES ($1, $2, NULL, $3, $4, $5, $6, COALESCE($7::date, CURRENT_DATE), $8, NOW(), $9) " +
        "RETURNING id, mime_type, file_size_bytes, caption, taken_at, photo_date, published_at, uploaded_at, original_filename",
        [
          photoId,
          storageKey,
          contentType,
          imageBuffer.byteLength,
          parsedFields.data.caption ?? null,
          parsedFields.data.takenAt ? new Date(parsedFields.data.takenAt) : null,
          parsedFields.data.photoDate ?? null,
          originalFilename.slice(0, 200),
          request.admin?.id ?? null
        ]
      );

      const photo = result.rows[0];
      return reply.code(201).send({
        data: {
          ...photo,
          media_url: `${request.protocol}://${request.hostname}/api/v1/photos/${photoId}/media`
        }
      });
    } catch (error) {
      try {
        await deleteMediaObject(storageKey);
      } catch (cleanupError) {
        request.log.error({ err: cleanupError, storageKey }, "Unable to clean up an uploaded file after database failure");
      }
      throw error;
    }
  });
};
