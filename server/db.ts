import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl =
  process.env.NEON_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_v2qroExba0tH@ep-dawn-hat-an0e6ord-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require";

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Configure your PostgreSQL/Neon connection string.");
}

export const pool = new Pool({
  connectionString: databaseUrl,
});

export async function query<T = unknown>(
  sqlText: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await pool.query(sqlText, params);
  return res.rows as T[];
}

