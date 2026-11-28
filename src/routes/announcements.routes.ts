import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { database } from "../database.js";
import { createSignedMediaUrl, isB2Configured } from "../storage/b2.js";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  offset: z.coerce.number().int().min(0).default(0)
});

export const announcementRoutes: FastifyPluginAsync = async (app) => {
  app.get("/announcements", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const parsed = listQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid query parameters", details: parsed.error.flatten() });
    }

    const { limit, offset } = parsed.data;
    const result = await database.query(
      "SELECT id, title, message, poster_storage_key, poster_media_url, published_at " +
      "FROM announcements WHERE published_at IS NOT NULL " +
      "ORDER BY published_at DESC, id DESC LIMIT $1 OFFSET $2",
      [limit, offset]
    );

    const hasPrivatePosters = result.rows.some((announcement) => announcement.poster_storage_key);
    if (hasPrivatePosters && !isB2Configured()) {
      return reply.code(503).send({ error: "Backblaze B2 storage is not configured" });
    }

    const data = await Promise.all(result.rows.map(async (announcement) => {
      const { poster_storage_key: storageKey, ...publicAnnouncement } = announcement;
      return {
        ...publicAnnouncement,
        poster_media_url: storageKey
          ? await createSignedMediaUrl(storageKey, "announcement-poster", "inline")
          : announcement.poster_media_url
      };
    }));

    return { data, pagination: { limit, offset, returned: result.rowCount ?? 0 } };
  });
};
