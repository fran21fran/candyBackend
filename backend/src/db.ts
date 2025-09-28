import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "./schema.js";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Disable prefetch as it is not supported for "Transaction" pool mode in Supabase
export const client = postgres(process.env.DATABASE_URL, { prepare: false });
export const db = drizzle({ client, schema });