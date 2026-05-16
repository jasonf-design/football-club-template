import { createCookieSessionStorage, redirect } from "react-router";
import { eq } from "drizzle-orm";
import { db } from "~/db.server";
import { users, type User } from "../../db/schema";

const secret = process.env.SESSION_SECRET;
if (!secret) {
  throw new Error(
    "SESSION_SECRET is not set. Copy .env.example to .env and configure.",
  );
}

const storage = createCookieSessionStorage({
  cookie: {
    name: "__dcfc_session",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    secrets: [secret],
    maxAge: 60 * 60 * 24 * 30,
  },
});

const USER_ID_KEY = "userId";

export async function createUserSession(userId: string, redirectTo: string) {
  const session = await storage.getSession();
  session.set(USER_ID_KEY, userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.commitSession(session) },
  });
}

export async function destroyUserSession(request: Request, redirectTo = "/admin/login") {
  const session = await storage.getSession(request.headers.get("Cookie"));
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await storage.destroySession(session) },
  });
}

export async function getSession(request: Request) {
  return storage.getSession(request.headers.get("Cookie"));
}

export async function getCurrentUser(request: Request): Promise<User | null> {
  const session = await getSession(request);
  const userId = session.get(USER_ID_KEY);
  if (!userId || typeof userId !== "string") return null;
  const [row] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return row ?? null;
}

export async function requireAdmin(request: Request): Promise<User> {
  const user = await getCurrentUser(request);
  if (!user) {
    const url = new URL(request.url);
    const next = encodeURIComponent(url.pathname + url.search);
    throw redirect(`/admin/login?next=${next}`);
  }
  return user;
}
