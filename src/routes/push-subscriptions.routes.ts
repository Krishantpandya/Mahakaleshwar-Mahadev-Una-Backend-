import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { database } from "../database.js";

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(4096),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512)
  }),
  channels: z.array(z.enum(["photos", "announcements"])).min(1).max(2)
}).refine((value) => new Set(value.channels).size === value.channels.length, {
  message: "Each notification channel may only be included once"
});

export const pushSubscriptionRoutes: FastifyPluginAsync = async (app) => {
  app.put("/push-subscriptions", async (request, reply) => {
    if (!database) {
      return reply.code(503).send({ error: "Database is not configured" });
    }

    const parsed = subscriptionSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        error: "Invalid push subscription",
        details: parsed.error.flatten()
      });
    }

    const client = await database.connect();
    try {
      await client.query("BEGIN");
      const { endpoint, keys, channels } = parsed.data;
      const subscription = await client.query(
        "INSERT INTO push_subscriptions (endpoint, p256dh_key, auth_key) " +
        "VALUES ($1, $2, $3) " +
        "ON CONFLICT (endpoint) DO UPDATE SET " +
        "p256dh_key = EXCLUDED.p256dh_key, auth_key = EXCLUDED.auth_key, updated_at = NOW() " +
        "RETURNING id",
        [endpoint, keys.p256dh, keys.auth]
      );

      const subscriptionId = subscription.rows[0].id as string;
      await client.query(
        "DELETE FROM push_subscription_channels WHERE push_subscription_id = $1",
        [subscriptionId]
      );

      for (const channel of channels) {
        await client.query(
          "INSERT INTO push_subscription_channels (push_subscription_id, channel) VALUES ($1, $2)",
          [subscriptionId, channel]
        );
      }

      await client.query("COMMIT");
      return reply.code(200).send({ subscribed: channels });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  });
};
