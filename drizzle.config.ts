import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL || "";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
