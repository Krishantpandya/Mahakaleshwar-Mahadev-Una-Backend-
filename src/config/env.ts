import "dotenv/config";
import { z } from "zod";

const optionalText = z.preprocess((value) => value === "" ? undefined : value, z.string().min(1).optional());
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  DATABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  ADMIN_SESSION_COOKIE: z.string().min(1).default("mankaleshwar_admin_session"),
  ADMIN_SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  ADMIN_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
  ADMIN_PASSWORD: z.preprocess((value) => value === "" ? undefined : value, z.string().min(12).optional())
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "DATABASE_URL is required in production" });
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  adminSessionCookie: parsed.data.ADMIN_SESSION_COOKIE,
  adminSessionDays: parsed.data.ADMIN_SESSION_DAYS,
  adminEmail: parsed.data.ADMIN_EMAIL?.trim().toLowerCase(),
  adminPassword: parsed.data.ADMIN_PASSWORD
};
