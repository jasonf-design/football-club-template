import { and, eq, ne } from "drizzle-orm";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-users-edit";
import { db } from "~/db.server";
import { users } from "../../db/schema";
import { requireAdminRole } from "~/lib/session.server";
import { hashPassword } from "~/lib/password.server";
import {
  AdminBreadcrumbs,
  AdminPage,
  PrimaryButton,
} from "~/components/admin/AdminShell";
import { Field, FormRow, Select, TextInput } from "~/components/admin/Field";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Edit user · Admin" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  const me = await requireAdminRole(request);
  const [target] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);
  if (!target) throw new Response("Not found", { status: 404 });
  return { target, isSelf: target.id === me.id };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(["admin", "editor"]),
});

const passwordSchema = z
  .object({
    password: z.string().min(12, "Use at least 12 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function action({ request, params }: Route.ActionArgs) {
  const me = await requireAdminRole(request);
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, params.id))
    .limit(1);
  if (!target) throw new Response("Not found", { status: 404 });

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "profile") {
    const parsed = profileSchema.safeParse({
      name: form.get("name"),
      role: form.get("role") ?? target.role,
    });
    if (!parsed.success) {
      return {
        section: "profile" as const,
        errors: errorMap(parsed.error.issues),
      };
    }
    if (
      target.role === "admin" &&
      parsed.data.role !== "admin"
    ) {
      if (target.id === me.id) {
        return {
          section: "profile" as const,
          errors: { role: "You can't demote yourself." },
        };
      }
      const otherAdmins = await db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, "admin"), ne(users.id, target.id)));
      if (otherAdmins.length === 0) {
        return {
          section: "profile" as const,
          errors: { role: "Can't demote the last admin." },
        };
      }
    }
    await db
      .update(users)
      .set({ name: parsed.data.name, role: parsed.data.role })
      .where(eq(users.id, target.id));
    throw redirect("/admin/users");
  }

  if (intent === "password") {
    const parsed = passwordSchema.safeParse({
      password: form.get("password"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) {
      return {
        section: "password" as const,
        errors: errorMap(parsed.error.issues),
      };
    }
    const passwordHash = await hashPassword(parsed.data.password);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, target.id));
    return { section: "password" as const, ok: "Password reset." };
  }

  return { section: null, errors: {} };
}

function errorMap(issues: { path: (string | number)[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "_");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export default function AdminUsersEdit({ loaderData }: Route.ComponentProps) {
  const { target, isSelf } = loaderData;
  const data = useActionData<typeof action>();
  const profileErr = data?.section === "profile" ? data.errors ?? {} : {};
  const passwordErr = data?.section === "password" ? data.errors ?? {} : {};
  const passwordOk = data?.section === "password" ? data.ok : undefined;
  const nav = useNavigation();
  const submittingProfile =
    nav.state === "submitting" && nav.formData?.get("intent") === "profile";
  const submittingPassword =
    nav.state === "submitting" && nav.formData?.get("intent") === "password";

  return (
    <AdminPage
      eyebrow="Team access"
      title={target.name}
      description={target.email}
    >
      <AdminBreadcrumbs
        items={[
          { label: "Users", to: "/admin/users" },
          { label: target.name },
        ]}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
        <section className="bg-paper border border-line p-6 lg:p-8">
          <h2 className="font-display tracking-wider text-navy mb-5">
            PROFILE
          </h2>
          <Form method="post" className="space-y-5">
            <input type="hidden" name="intent" value="profile" />
            <Field
              name="name"
              label="Display name"
              error={profileErr.name}
              required
            >
              <TextInput name="name" defaultValue={target.name} required />
            </Field>
            <FormRow cols={2}>
              <Field name="role" label="Role" error={profileErr.role}>
                <Select
                  name="role"
                  defaultValue={target.role}
                  disabled={isSelf}
                >
                  <option value="editor">Editor</option>
                  <option value="admin">Admin</option>
                </Select>
              </Field>
              <Field name="email" label="Email" hint="Read only">
                <TextInput value={target.email} readOnly disabled />
              </Field>
            </FormRow>
            {isSelf && (
              <p className="text-xs text-mute">
                You can't change your own role here.{" "}
                <Link to="/admin/account" className="underline">
                  Update your name & password
                </Link>{" "}
                instead.
              </p>
            )}
            <PrimaryButton type="submit" disabled={submittingProfile}>
              {submittingProfile ? "Saving…" : "Save"}
            </PrimaryButton>
          </Form>
        </section>

        <section className="bg-paper border border-line p-6 lg:p-8">
          <h2 className="font-display tracking-wider text-navy mb-2">
            RESET PASSWORD
          </h2>
          <p className="text-mute text-sm mb-5">
            Set a new password for this user. They will need to sign in with it
            on their next visit.
          </p>
          {isSelf ? (
            <p className="text-sm text-ink">
              Use{" "}
              <Link to="/admin/account" className="underline">
                your account page
              </Link>{" "}
              to change your own password (it needs your current one).
            </p>
          ) : (
            <Form method="post" className="space-y-5">
              <input type="hidden" name="intent" value="password" />
              <Field
                name="password"
                label="New password"
                hint="Min 12 chars"
                error={passwordErr.password}
                required
              >
                <TextInput
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </Field>
              <Field
                name="confirmPassword"
                label="Confirm new password"
                error={passwordErr.confirmPassword}
                required
              >
                <TextInput
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                />
              </Field>
              {passwordOk && (
                <div className="border-l-2 border-green bg-green/5 text-green text-sm px-3 py-2">
                  {passwordOk}
                </div>
              )}
              <PrimaryButton type="submit" disabled={submittingPassword}>
                {submittingPassword ? "Saving…" : "Reset password"}
              </PrimaryButton>
            </Form>
          )}
        </section>
      </div>
    </AdminPage>
  );
}
