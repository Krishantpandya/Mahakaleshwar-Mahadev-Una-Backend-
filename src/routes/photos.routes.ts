import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import { database } from "../database.js";
import { openMediaObject } from "../storage/railway-volume.js";

const listQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
}).refine((value) => !value.from || !value.to || value.from <= value.to, {
  message: "'from' must be earlier than or equal to 'to'"
});

const uuidSchema = z.string().uuid();

function safeDispositionFilename(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() || "photo";
  return basename.replace(/[\r\n"]/g, "").replace(/[^\x20-\x7E]/g, "_").slice(0, 150) || "photo";
}

async function sendPhotoFile(
  reply: FastifyReply,
  storageKey: string,
  mimeType: string,
  filename: string,
  disposition: "inline" | "attachment"
) {
  const file = await openMediaObject(storageKey);
  if (!file) {
    return reply.code(404).send({ error: "Photo file not found" });
  }

  return reply
    .header("Content-Type", mimeType)
    .header("Content-Length", String(file.size))
    .header("Content-Disposition", `${disposition}; filename="${safeDispositionFilename(filename)}"`)
    .header("Cache-Control", "public, max-age=300")
    .header("X-Content-Type-Options", "nosniff")
    .send(file.stream);
}

export const photoRoutes: FastifyPluginAsync = async (app) => {
  app.get("/photos", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }

    const { from, to, limit, offset } = parsed.data;
    const values: unknown[] = [];
    const filters = ["published_at IS NOT NULL"];

    if (from) {
      values.push(from);
      filters.push("published_at >= $" + values.length + "::date");
    }
    if (to) {
      values.push(to);
      filters.push("published_at < ($" + values.length + "::date + INTERVAL '1 day')");
    }

    values.push(limit, offset);
    const limitIndex = values.length - 1;
    const offsetIndex = values.length;
    const sql = "SELECT id, storage_key, media_url, original_filename, mime_type, file_size_bytes, caption, taken_at, published_at " +
      "FROM photos WHERE " + filters.join(" AND ") +
      " ORDER BY published_at DESC, id DESC LIMIT $" + limitIndex + " OFFSET $" + offsetIndex;
    const result = await database.query(sql, values);

    const data = result.rows.map((photo) => {
      const { storage_key: storageKey, media_url: existingMediaUrl, original_filename: _originalFilename, ...publicPhoto } = photo;
      return {
        ...publicPhoto,
        media_url: storageKey
          ? `${request.protocol}://${request.hostname}/api/v1/photos/${photo.id}/media`
          : existingMediaUrl
      };
    });

    return { data, pagination: { limit, offset, returned: result.rowCount ?? 0 } };
  });

  app.get<{ Params: { photoId: string } }>("/photos/:photoId/media", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const photoId = uuidSchema.safeParse(request.params.photoId);
    if (!photoId.success) {
      return reply.code(400).send({ error: "A valid photoId UUID is required" });
    }

    const result = await database.query(
      "SELECT storage_key, original_filename, mime_type FROM photos WHERE id = $1 AND published_at IS NOT NULL",
      [photoId.data]
    );
    const photo = result.rows[0] as { storage_key: string | null; original_filename: string | null; mime_type: string | null } | undefined;
    if (!photo || !photo.storage_key) {
      return reply.code(404).send({ error: "Photo not found" });
    }

    return sendPhotoFile(reply, photo.storage_key, photo.mime_type || "application/octet-stream", photo.original_filename || "photo", "inline");
  });

  app.get<{ Params: { photoId: string } }>("/photos/:photoId/download", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const photoId = uuidSchema.safeParse(request.params.photoId);
    if (!photoId.success) {
      return reply.code(400).send({ error: "A valid photoId UUID is required" });
    }

    const result = await database.query(
      "SELECT storage_key, original_filename, mime_type FROM photos WHERE id = $1 AND published_at IS NOT NULL",
      [photoId.data]
    );
    const photo = result.rows[0] as { storage_key: string | null; original_filename: string | null; mime_type: string | null } | undefined;
    if (!photo || !photo.storage_key) {
      return reply.code(404).send({ error: "Photo not found" });
    }

    return sendPhotoFile(reply, photo.storage_key, photo.mime_type || "application/octet-stream", photo.original_filename || "photo", "attachment");
  });

  app.post<{ Params: { photoId: string } }>("/photos/:photoId/likes", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const photoId = uuidSchema.safeParse(request.params.photoId);
    const body = z.object({ visitorId: uuidSchema }).safeParse(request.body);
    if (!photoId.success || !body.success) {
      return reply.code(400).send({ error: "A valid photoId and visitorId UUID are required" });
    }

    const photo = await database.query(
      "SELECT id FROM photos WHERE id = $1 AND published_at IS NOT NULL",
      [photoId.data]
    );
    if (photo.rowCount === 0) {
      return reply.code(404).send({ error: "Photo not found" });
    }

    await database.query(
      "INSERT INTO photo_likes (photo_id, visitor_id) VALUES ($1, $2) ON CONFLICT (photo_id, visitor_id) DO NOTHING",
      [photoId.data, body.data.visitorId]
    );
    const count = await database.query(
      "SELECT COUNT(*)::int AS count FROM photo_likes WHERE photo_id = $1",
      [photoId.data]
    );

    return reply.code(200).send({ liked: true, likeCount: count.rows[0]?.count ?? 0 });
  });
};
