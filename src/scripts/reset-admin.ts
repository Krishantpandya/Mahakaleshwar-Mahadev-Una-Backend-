import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { env } from "../config/env.js";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

async function main(): Promise<void> {
  if (!env.databaseUrl || !env.adminEmail || !env.adminPassword) {
    throw new Error("Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD before resetting the admin.");
  }

  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(env.adminPassword, salt, 64)) as Buffer;
  const passwordHash = `scrypt$${salt}$${hash.toString("hex")}`;
  const pool = new Pool({ connectionString: env.databaseUrl, max: 1, connectionTimeoutMillis: 5000 });

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const existing = await client.query(
        "SELECT id FROM admins WHERE lower(email) = lower($1) FOR UPDATE",
        [env.adminEmail]
      );
      if (existing.rowCount !== 1) {
        throw new Error(`Expected exactly one admin account for ${env.adminEmail}; found ${existing.rowCount ?? 0}.`);
      }
      await client.query("DELETE FROM admin_sessions WHERE admin_id = $1", [existing.rows[0].id]);
      await client.query("UPDATE admins SET password_hash = $1 WHERE id = $2", [passwordHash, existing.rows[0].id]);
      await client.query("COMMIT");
      console.info(`Admin password reset successfully for ${env.adminEmail}.`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Admin password reset failed");
  process.exitCode = 1;
});
