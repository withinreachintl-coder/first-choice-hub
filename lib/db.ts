import { Pool } from "pg";

// Direct Postgres connection to the isolated `first_choice` schema in the
// shared wri-suite Supabase project. We bypass PostgREST (which only exposes
// `public`) so first_choice stays invisible to the rest of the suite's API.
// Use the transaction pooler connection string (port 6543) in FC_DATABASE_URL.

const globalForPg = globalThis as unknown as { fcPool?: Pool };

export const pool =
  globalForPg.fcPool ??
  new Pool({
    connectionString: process.env.FC_DATABASE_URL,
    max: 1,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") globalForPg.fcPool = pool;

export async function query<T = unknown>(text: string, params?: unknown[]) {
  const res = await pool.query(text, params as never);
  return res.rows as T[];
}
