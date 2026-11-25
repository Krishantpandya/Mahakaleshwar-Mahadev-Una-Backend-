import pg from "pg";
import { env } from "./config/env.js";

const { Pool } = pg;

export const database = env.databaseUrl
  ? new Pool({
      connectionString: env.databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000
    })
  : null;
