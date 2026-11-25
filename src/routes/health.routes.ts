import type { FastifyInstance } from "fastify";

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", {
    schema: {
      response: {
        200: {
          type: "object",
          required: ["status", "service", "timestamp"],
          properties: {
            status: { type: "string", enum: ["ok"] },
            service: { type: "string" },
            timestamp: { type: "string", format: "date-time" }
          }
        }
      }
    }
  }, async () => ({
    status: "ok" as const,
    service: "mankaleshwar-mahadev-api",
    timestamp: new Date().toISOString()
  }));
}
