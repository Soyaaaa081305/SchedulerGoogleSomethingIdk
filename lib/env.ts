import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  NEXTAUTH_URL: z.string().url("NEXTAUTH_URL must be a valid URL").optional(),
  NEXTAUTH_SECRET: z.string().min(1, "NEXTAUTH_SECRET is required"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
  GEMINI_API_KEY: z.string().min(1, "GEMINI_API_KEY is required"),
  CRON_SECRET: z.string().min(1, "CRON_SECRET is required"),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
});

let validated: z.infer<typeof envSchema> | null = null;

export function getEnv() {
  if (validated) return validated;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const missing = result.error.issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n");
    console.error(`[env] Missing or invalid environment variables:\n${missing}`);
    // Don't crash in production — degrade gracefully
    if (process.env.NODE_ENV === "production") {
      console.warn("[env] Running with potentially missing env vars. Some features may not work.");
      validated = process.env as unknown as z.infer<typeof envSchema>;
      return validated;
    }
    throw new Error(`Missing environment variables:\n${missing}`);
  }

  validated = result.data;
  return validated;
}
