import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set. Please ensure the Replit PostgreSQL database is provisioned.");
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

