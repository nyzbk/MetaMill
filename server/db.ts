import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  console.warn(
    "Warning: DATABASE_URL is not set. Database operations will fail.",
  );
}

// Export db instance and pool
// Instead of empty string which causes "Invalid URL" crash, use a safe dummy string or skip instantiation
const connString = process.env.DATABASE_URL || "postgres://dummy:dummy@localhost:5432/dummy";
export const pool = new Pool({ connectionString: connString });
export const db = drizzle(pool, { schema });
