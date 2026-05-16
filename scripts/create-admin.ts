import "dotenv/config";
import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { eq } from "drizzle-orm";
import { hash } from "@node-rs/argon2";
import { createId } from "@paralleldrive/cuid2";
import { users } from "../db/schema";

const url = process.env.DB_URL ?? "file:./local.sqlite";
const client = createClient({ url });
const db = drizzle(client);

const rl = createInterface({ input: stdin, output: stdout });

function ask(prompt: string, { mask = false } = {}): Promise<string> {
  return new Promise((resolve) => {
    if (mask) {
      const writeFn = (rl as unknown as { _writeToOutput: (s: string) => void })
        ._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
        (s: string) => {
          if (s.startsWith(prompt) || s === "\n" || s === "\r\n") {
            stdout.write(s);
          } else {
            stdout.write("*");
          }
        };
      rl.question(prompt, (answer) => {
        (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput =
          writeFn;
        resolve(answer.trim());
      });
    } else {
      rl.question(prompt, (answer) => resolve(answer.trim()));
    }
  });
}

const email = (await ask("Email: ")).toLowerCase();
const name = await ask("Display name: ");
const password = await ask("Password (min 12 chars): ", { mask: true });
rl.close();

if (!email.includes("@")) {
  console.error("Invalid email");
  process.exit(1);
}
if (password.length < 12) {
  console.error("Password must be at least 12 characters");
  process.exit(1);
}

const [existing] = await db
  .select()
  .from(users)
  .where(eq(users.email, email))
  .limit(1);

if (existing) {
  console.error(`A user already exists with email ${email}`);
  process.exit(1);
}

const passwordHash = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
});

await db.insert(users).values({
  id: createId(),
  email,
  name,
  passwordHash,
  role: "admin",
});

console.log(`Created admin: ${email}`);
client.close();
