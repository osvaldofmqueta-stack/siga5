import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const NEON_URL =
  "postgresql://neondb_owner:npg_v2qroExba0tH@ep-dawn-hat-an0e6ord-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

const dbUrl = process.env.NEON_DATABASE_URL || NEON_URL;

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
