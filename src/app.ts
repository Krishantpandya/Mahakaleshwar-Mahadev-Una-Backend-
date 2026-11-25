import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { database } from "./database.js";
import { healthRoutes } from "./routes/health.routes.js";
import { photoRoutes } from "./routes/photos.routes.js";
import { announcementRoutes } from "./routes/announcements.routes.js";

export function buildApp() {
  const app = Fastify({
    logger: {
      level: env.nodeEnv === "production" ? "info" : "debug",
      redact: {
        paths: ["req.headers.authorization", "req.headers.cookie"],
        censor: "[REDACTED]"
      }
    },
    trustProxy: false,
    disableRequestLogging: false
  });

  app.register(helmet);
  app.register(cors, {
    origin: env.corsOrigins,
    credentials: false
  });
  app.register(rateLimit, {
    max: 100,
    timeWindow: "1 minute"
  });

  app.register(healthRoutes, { prefix: "/api/v1" });
  app.register(photoRoutes, { prefix: "/api/v1" });
  app.register(announcementRoutes, { prefix: "/api/v1" });

  app.addHook("onClose", async () => {
    await database?.end();
  });

  app.setErrorHandler((error, request, reply) => {
    const normalizedError = error instanceof Error ? error : new Error(String(error));
    const errorStatus = (normalizedError as Error & { statusCode?: number }).statusCode;
    request.log.error({ err: normalizedError }, "Request failed");

    const statusCode = errorStatus && errorStatus >= 400 && errorStatus < 500
      ? errorStatus
      : 500;

    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : normalizedError.name,
      message: statusCode === 500 ? "An unexpected error occurred." : normalizedError.message
    });
  });

  return app;
}
