import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import { env } from "./config/env.js";
import { healthRoutes } from "./routes/health.routes.js";

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

  app.setErrorHandler((error, request, reply) => {
    request.log.error({ err: error }, "Request failed");

    const statusCode = error.statusCode && error.statusCode >= 400 && error.statusCode < 500
      ? error.statusCode
      : 500;

    return reply.status(statusCode).send({
      error: statusCode === 500 ? "Internal Server Error" : error.name,
      message: statusCode === 500 ? "An unexpected error occurred." : error.message
    });
  });

  return app;
}
