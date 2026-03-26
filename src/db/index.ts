import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

let pool: Pool | null = null;

export function getDb(databaseUrl: string) {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });
  }
  return drizzle(pool, { schema });
}

export async function closeDb() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export type Db = ReturnType<typeof getDb>;
