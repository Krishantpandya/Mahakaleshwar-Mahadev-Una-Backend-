import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { database } from "./database.js";
import { closeMediaStorage } from "./storage/b2.js";
import { healthRoutes } from "./routes/health.routes.js";
import { photoRoutes } from "./routes/photos.routes.js";
import { announcementRoutes } from "./routes/announcements.routes.js";
import { pushSubscriptionRoutes } from "./routes/push-subscriptions.routes.js";
import { adminAuthRoutes } from "./routes/admin-auth.routes.js";
import { adminPhotoRoutes } from "./routes/admin-photos.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "production" ? "info" : "debug",
      redact: { paths: ["req.headers.authorization", "req.headers.cookie", "res.headers.set-cookie"], censor: "[REDACTED]" }
    },
    trustProxy: true
  });

  app.register(helmet);
  app.register(cookie);
  app.register(cors, { origin: env.corsOrigins, credentials: true });
  app.register(rateLimit, { max: 100, timeWindow: "1 minute" });
  app.register(multipart, {
    limits: {
      fileSize: env.maxUploadBytes,
      files: 1,
      fields: 3
    }
  });

  app.register(healthRoutes, { prefix: "/api/v1" });
  app.register(photoRoutes, { prefix: "/api/v1" });
  app.register(announcementRoutes, { prefix: "/api/v1" });
  app.register(pushSubscriptionRoutes, { prefix: "/api/v1" });
  app.register(adminAuthRoutes, { prefix: "/api/v1/admin/auth" });
  app.register(adminPhotoRoutes, { prefix: "/api/v1/admin/photos" });

  app.addHook("onClose", async () => {
    await database?.end();
    closeMediaStorage();
  });
  app.setErrorHandler((error, request, reply) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const errorStatus = (normalizedError as Error & { statusCode?: number }).statusCode;
    request.log.error({ err: normalizedError }, "Request failed");
    const statusCode = errorStatus && errorStatus >= 400 && errorStatus < 500 ? errorStatus : 500;
    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : normalizedError.name,
      message: statusCode === 500 ? "An unexpected error occurred." : normalizedError.message
    });
  });
  return app;
}
