import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const dbUrl =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_v2qroExba0tH@ep-dawn-hat-an0e6ord-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (!dbUrl) {
  throw new Error("DATABASE_URL, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
