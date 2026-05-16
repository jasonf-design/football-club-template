import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

const url = process.env.DB_URL ?? "file:./local.sqlite";
const client = createClient({ url });
const db = drizzle(client);

console.log(`Migrating ${url}...`);
await migrate(db, { migrationsFolder: "./drizzle" });
console.log("Done.");
client.close();
