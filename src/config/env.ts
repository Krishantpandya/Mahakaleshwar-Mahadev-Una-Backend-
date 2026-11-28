import "dotenv/config";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : typeof value === "string" ? value.trim() : value,
  z.string().min(1).optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:5173"),
  DATABASE_URL: z.preprocess((value) => value === "" ? undefined : value, z.string().url().optional()),
  ADMIN_SESSION_COOKIE: z.string().min(1).default("mankaleshwar_admin_session"),
  ADMIN_SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  ADMIN_EMAIL: z.preprocess((value) => value === "" ? undefined : value, z.string().email().optional()),
  ADMIN_PASSWORD: z.preprocess((value) => value === "" ? undefined : value, z.string().min(12).optional()),
  B2_BUCKET_NAME: optionalText,
  B2_REGION: optionalText,
  B2_ENDPOINT: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().url().refine((value) => value.startsWith("https://"), "B2_ENDPOINT must use HTTPS").optional()
  ),
  B2_KEY_ID: optionalText,
  B2_APPLICATION_KEY: optionalText,
  B2_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  B2_MAX_UPLOAD_BYTES: z.coerce.number().int().min(1024).max(50 * 1024 * 1024).default(20 * 1024 * 1024)
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.DATABASE_URL) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "DATABASE_URL is required in production" });
  }

  const b2Fields = [
    ["B2_BUCKET_NAME", value.B2_BUCKET_NAME],
    ["B2_REGION", value.B2_REGION],
    ["B2_ENDPOINT", value.B2_ENDPOINT],
    ["B2_KEY_ID", value.B2_KEY_ID],
    ["B2_APPLICATION_KEY", value.B2_APPLICATION_KEY]
  ] as const;
  const hasAnyB2Setting = b2Fields.some(([, setting]) => Boolean(setting));
  const hasAllB2Settings = b2Fields.every(([, setting]) => Boolean(setting));

  if (hasAnyB2Setting && !hasAllB2Settings) {
    for (const [field, setting] of b2Fields) {
      if (!setting) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "All five B2 connection settings must be configured together"
        });
      }
    }
  }
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid environment configuration:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const b2Configured = Boolean(
  parsed.data.B2_BUCKET_NAME &&
  parsed.data.B2_REGION &&
  parsed.data.B2_ENDPOINT &&
  parsed.data.B2_KEY_ID &&
  parsed.data.B2_APPLICATION_KEY
);

export const env = {
  nodeEnv: parsed.data.NODE_ENV,
  host: parsed.data.HOST,
  port: parsed.data.PORT,
  databaseUrl: parsed.data.DATABASE_URL,
  corsOrigins: parsed.data.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
  adminSessionCookie: parsed.data.ADMIN_SESSION_COOKIE,
  adminSessionDays: parsed.data.ADMIN_SESSION_DAYS,
  adminEmail: parsed.data.ADMIN_EMAIL?.trim().toLowerCase(),
  adminPassword: parsed.data.ADMIN_PASSWORD,
  b2: b2Configured ? {
    bucketName: parsed.data.B2_BUCKET_NAME!,
    region: parsed.data.B2_REGION!,
    endpoint: parsed.data.B2_ENDPOINT!,
    keyId: parsed.data.B2_KEY_ID!,
    applicationKey: parsed.data.B2_APPLICATION_KEY!,
    signedUrlTtlSeconds: parsed.data.B2_SIGNED_URL_TTL_SECONDS
  } : null,
  b2MaxUploadBytes: parsed.data.B2_MAX_UPLOAD_BYTES
};
