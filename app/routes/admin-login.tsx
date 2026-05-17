import { eq } from "drizzle-orm";
import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/admin-login";
import { db } from "~/db.server";
import { users } from "../../db/schema";
import { verifyPassword } from "~/lib/password.server";
import { createUserSession, getCurrentUser } from "~/lib/session.server";
import { Crest } from "~/components/Crest";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sign in · Doncaster City FC" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await getCurrentUser(request);
  if (user) throw redirect("/admin");
  return null;
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "")
    .toLowerCase()
    .trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "/admin");

  if (!email || !password) {
    return { error: "Please enter your email and password." };
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Run verify even on missing user to mitigate timing differences. We pass a
  // throwaway hash so verify still does work, then check the user existed.
  const stored =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$xxxxxxxxxxxxxxxxxxxxxx$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";
  let ok = false;
  try {
    ok = await verifyPassword(stored, password);
  } catch {
    ok = false;
  }

  if (!user || !ok) {
    return { error: "Email or password isn't right." };
  }

  return createUserSession(user.id, next.startsWith("/admin") ? next : "/admin");
}

export default function AdminLogin() {
  const result = useActionData<typeof action>();
  return (
    <main className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-paper">
      <div className="hidden lg:flex relative bg-navy text-paper p-12 flex-col justify-between overflow-hidden">
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full border border-sky/20" />
        <div className="absolute -bottom-20 -right-20 h-64 w-64 rounded-full border border-sky/30" />
        <Link to="/" className="flex items-center gap-3 relative">
          <Crest className="h-12 w-12" />
          <div className="leading-tight">
            <div className="font-display text-xl tracking-wide">
              DONCASTER CITY
            </div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky">
              Football Club · Est 2022
            </div>
          </div>
        </Link>
        <div className="relative">
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky mb-3">
            Staff area
          </div>
          <h1 className="font-serif text-5xl leading-tight">
            Welcome
            <br />
            back.
          </h1>
          <p className="mt-6 text-paper/70 max-w-md leading-relaxed">
            Sign in to manage news, fixtures, the squad, and the pitch
            sponsorship campaign.
          </p>
        </div>
        <div className="relative text-xs text-paper/40">
          For supporters: the site is just at{" "}
          <Link to="/" className="text-sky">
            doncastercityfc.com
          </Link>
          .
        </div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <Crest className="h-10 w-10" />
            <div className="font-display text-lg text-navy tracking-wide">
              DCFC ADMIN
            </div>
          </div>
          <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-3">
            Sign in
          </div>
          <h2 className="font-serif text-3xl text-navy">Staff login</h2>
          <p className="text-mute mt-2 text-sm">
            Enter your club admin credentials.
          </p>

          <Form method="post" className="mt-8 space-y-5">
            <Field name="email" label="Email" type="email" autoComplete="email" required />
            <Field
              name="password"
              label="Password"
              type="password"
              autoComplete="current-password"
              required
            />
            <input type="hidden" name="next" value={getNext()} />
            {result?.error && (
              <div className="border-l-2 border-red bg-red/5 text-red text-sm px-3 py-2">
                {result.error}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-navy text-paper py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
            >
              Sign in
            </button>
          </Form>
        </div>
      </div>
    </main>
  );
}

function getNext() {
  if (typeof window === "undefined") return "/admin";
  const params = new URLSearchParams(window.location.search);
  return params.get("next") ?? "/admin";
}

function Field({
  name,
  label,
  type,
  autoComplete,
  required,
}: {
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.24em] text-mute mb-2">
        {label}
      </span>
      <input
        name={name}
        type={type}
        autoComplete={autoComplete}
        required={required}
        className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink transition-colors"
      />
    </label>
  );
}
