import "server-only";

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env } from "@/env";
import { logFailure } from "@/diagnostics/server";

function createPool() {
  const pool = new Pool({ connectionString: env.databaseUrl, connectionTimeoutMillis: 5000 });
  pool.on("error", (error) => {
    logFailure("database_pool_failed", "pool", error);
  });
  return pool;
}

const databaseGlobal: typeof globalThis & { afcsDatabasePool?: Pool } = globalThis;
const pool = databaseGlobal.afcsDatabasePool ?? createPool();

if (env.nodeEnvironment === "development") databaseGlobal.afcsDatabasePool = pool;

export const db = drizzle({ client: pool });
