import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";
import { env } from "../config/env.js";

const scrypt = promisify(scryptCallback);
const { Pool } = pg;

async function main(): Promise<void> {
  if (!env.databaseUrl || !env.adminEmail || !env.adminPassword) {
    throw new Error("Set DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters) before provisioning the admin.");
  }
  const salt = randomBytes(16).toString("hex");
  const hash = (await scrypt(env.adminPassword, salt, 64)) as Buffer;
  const passwordHash = `scrypt$${salt}$${hash.toString("hex")}`;
  const pool = new Pool({ connectionString: env.databaseUrl, max: 1, connectionTimeoutMillis: 5000 });
  try {
    const existing = await pool.query("SELECT id FROM admins LIMIT 1");
    if (existing.rowCount) throw new Error("An admin account already exists. Single-admin provisioning will not create or replace it.");
    await pool.query("INSERT INTO admins (email, password_hash) VALUES ($1, $2)", [env.adminEmail, passwordHash]);
    console.info("The single admin account was created successfully.");
  } finally {
    await pool.end();
  }
}
main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : "Admin provisioning failed"); process.exitCode = 1; });
