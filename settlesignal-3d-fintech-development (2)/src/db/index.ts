import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL?.trim();

const missingDatabaseUrlError = () =>
  new Error(
    "DATABASE_URL is required for SettleSignal database operations. Add it in Vercel Project Settings → Environment Variables, then redeploy.",
  );

const globalForDb = globalThis as typeof globalThis & {
  __arenaNextJsPostgresqlPool?: Pool;
};

function createPool(): Pool {
  if (databaseUrl) {
    return new Pool({ connectionString: databaseUrl });
  }

  // Do not throw while this module is imported. Next.js imports route modules
  // during `next build`, even when the route itself is dynamic. Defer the
  // configuration error until code actually attempts a database operation.
  // This does not make the database optional at runtime: DB-backed requests
  // still fail clearly until DATABASE_URL is configured.
  const unavailablePool = new Pool();
  return new Proxy(unavailablePool, {
    get(target, property) {
      if (property === "query" || property === "connect") {
        return () => Promise.reject(missingDatabaseUrlError());
      }

      const value = Reflect.get(target, property, target) as unknown;
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as Pool;
}

export const pool =
  globalForDb.__arenaNextJsPostgresqlPool ?? createPool();

if (process.env.NODE_ENV !== "production") {
  globalForDb.__arenaNextJsPostgresqlPool = pool;
}

export const db = drizzle(pool, { schema });
