import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "../db/schema";

const url = process.env.DB_URL;
if (!url) {
  throw new Error("DB_URL is not set. Copy .env.example to .env and configure.");
}

const client = createClient({ url });
export const db = drizzle(client, { schema });
export { schema };
