import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { database } from "../database.js";
import { env } from "../config/env.js";

const scrypt = promisify(scryptCallback);
const credentialsSchema = z.object({ email: z.string().email().max(254), password: z.string().min(1).max(200) });

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, salt, expectedHex] = stored.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHex || !/^[a-f0-9]{128}$/i.test(expectedHex)) return false;
  const expected = Buffer.from(expectedHex, "hex");
  const actual = (await scrypt(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (!database) {
    await reply.code(503).send({ error: "Database is not configured" });
    return;
  }
  const token = request.cookies[env.adminSessionCookie];
  if (!token || token.length > 256) {
    await reply.code(401).send({ error: "Authentication required" });
    return;
  }
  const result = await database.query(
    "SELECT a.id, a.email FROM admin_sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = $1 AND s.expires_at > NOW()",
    [hashToken(token)]
  );
  if (!result.rows[0]) {
    await reply.clearCookie(env.adminSessionCookie, { path: "/" });
    await reply.code(401).send({ error: "Authentication required" });
    return;
  }
  request.admin = { id: result.rows[0].id as string, email: result.rows[0].email as string };
  await database.query("UPDATE admin_sessions SET last_seen_at = NOW() WHERE token_hash = $1", [hashToken(token)]);
}

declare module "fastify" {
  interface FastifyRequest {
    admin?: { id: string; email: string };
  }
}

export const adminAuthRoutes: FastifyPluginAsync = async (app) => {
  app.post("/login", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
    if (!database) return reply.code(503).send({ error: "Database is not configured" });
    const parsed = credentialsSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: "Invalid email or password format" });

    const result = await database.query("SELECT id, email, password_hash FROM admins WHERE lower(email) = lower($1)", [parsed.data.email]);
    const admin = result.rows[0] as { id: string; email: string; password_hash: string } | undefined;
    const valid = admin ? await verifyPassword(parsed.data.password, admin.password_hash) : false;
    if (!valid || !admin) return reply.code(401).send({ error: "Invalid email or password" });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + env.adminSessionDays * 24 * 60 * 60 * 1000);
    await database.query("INSERT INTO admin_sessions (admin_id, token_hash, expires_at) VALUES ($1, $2, $3)", [admin.id, hashToken(token), expiresAt]);
    reply.setCookie(env.adminSessionCookie, token, {
      path: "/", httpOnly: true, secure: env.nodeEnv === "production", sameSite: "strict",
      expires: expiresAt
    });
    return reply.send({ authenticated: true, admin: { id: admin.id, email: admin.email }, expiresAt });
  });

  app.post("/logout", async (request, reply) => {
    const token = request.cookies[env.adminSessionCookie];
    if (database && token) await database.query("DELETE FROM admin_sessions WHERE token_hash = $1", [hashToken(token)]);
    reply.clearCookie(env.adminSessionCookie, { path: "/" });
    return reply.send({ authenticated: false });
  });

  app.get("/me", { preHandler: requireAdmin }, async (request) => ({
    authenticated: true,
    admin: request.admin
  }));
};
