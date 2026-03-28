import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config();

const databaseUrl = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

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

