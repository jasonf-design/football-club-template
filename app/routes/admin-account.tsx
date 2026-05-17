import { eq } from "drizzle-orm";
import { Form, useActionData, useNavigation } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-account";
import { db } from "~/db.server";
import { users } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { hashPassword, verifyPassword } from "~/lib/password.server";
import {
  AdminPage,
  PrimaryButton,
  StatusPill,
} from "~/components/admin/AdminShell";
import { Field, FormRow, TextInput } from "~/components/admin/Field";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Your account · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
  };
}

const profileSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(12, "Use at least 12 characters"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "profile") {
    const parsed = profileSchema.safeParse({ name: form.get("name") });
    if (!parsed.success) {
      return {
        section: "profile" as const,
        errors: errorMap(parsed.error.issues),
      };
    }
    await db
      .update(users)
      .set({ name: parsed.data.name })
      .where(eq(users.id, user.id));
    return { section: "profile" as const, ok: "Profile updated." };
  }

  if (intent === "password") {
    const parsed = passwordSchema.safeParse({
      currentPassword: form.get("currentPassword"),
      newPassword: form.get("newPassword"),
      confirmPassword: form.get("confirmPassword"),
    });
    if (!parsed.success) {
      return {
        section: "password" as const,
        errors: errorMap(parsed.error.issues),
      };
    }
    let ok = false;
    try {
      ok = await verifyPassword(user.passwordHash, parsed.data.currentPassword);
    } catch {
      ok = false;
    }
    if (!ok) {
      return {
        section: "password" as const,
        errors: { currentPassword: "That doesn't match your current password." },
      };
    }
    const passwordHash = await hashPassword(parsed.data.newPassword);
    await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
    return { section: "password" as const, ok: "Password changed." };
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

export default function AdminAccount({ loaderData }: Route.ComponentProps) {
  const { user } = loaderData;
  const data = useActionData<typeof action>();
  const profileErr = data?.section === "profile" ? data.errors ?? {} : {};
  const passwordErr = data?.section === "password" ? data.errors ?? {} : {};
  const profileOk = data?.section === "profile" ? data.ok : undefined;
  const passwordOk = data?.section === "password" ? data.ok : undefined;

  return (
    <AdminPage
      eyebrow="Your account"
      title="Account settings"
      description="Manage your name and password. Signed in as the email below."
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
        <section className="bg-paper border border-line p-6 lg:p-8">
          <header className="flex items-center justify-between mb-5">
            <h2 className="font-display tracking-wider text-navy">PROFILE</h2>
            <StatusPill
              status={user.role === "admin" ? "ok" : "muted"}
              label={user.role === "admin" ? "Admin" : "Editor"}
            />
          </header>
          <ProfileForm
            user={user}
            errors={profileErr}
            ok={profileOk}
          />
        </section>

        <section className="bg-paper border border-line p-6 lg:p-8">
          <header className="mb-5">
            <h2 className="font-display tracking-wider text-navy">PASSWORD</h2>
            <p className="text-mute text-sm mt-2">
              At least 12 characters. Use a long passphrase or a password manager.
            </p>
          </header>
          <PasswordForm errors={passwordErr} ok={passwordOk} />
        </section>
      </div>
    </AdminPage>
  );
}

function ProfileForm({
  user,
  errors,
  ok,
}: {
  user: { name: string; email: string };
  errors: Record<string, string>;
  ok?: string;
}) {
  const nav = useNavigation();
  const submitting =
    nav.state === "submitting" && nav.formData?.get("intent") === "profile";
  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="intent" value="profile" />
      <FormRow cols={1}>
        <Field name="email" label="Email">
          <TextInput value={user.email} disabled readOnly />
        </Field>
      </FormRow>
      <Field name="name" label="Display name" error={errors.name} required>
        <TextInput name="name" defaultValue={user.name} required />
      </Field>
      {ok && (
        <div className="border-l-2 border-green bg-green/5 text-green text-sm px-3 py-2">
          {ok}
        </div>
      )}
      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Save profile"}
      </PrimaryButton>
    </Form>
  );
}

function PasswordForm({
  errors,
  ok,
}: {
  errors: Record<string, string>;
  ok?: string;
}) {
  const nav = useNavigation();
  const submitting =
    nav.state === "submitting" && nav.formData?.get("intent") === "password";
  return (
    <Form method="post" className="space-y-5">
      <input type="hidden" name="intent" value="password" />
      <Field
        name="currentPassword"
        label="Current password"
        error={errors.currentPassword}
        required
      >
        <TextInput
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>
      <Field
        name="newPassword"
        label="New password"
        hint="Min 12 chars"
        error={errors.newPassword}
        required
      >
        <TextInput
          name="newPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={12}
        />
      </Field>
      <Field
        name="confirmPassword"
        label="Confirm new password"
        error={errors.confirmPassword}
        required
      >
        <TextInput
          name="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </Field>
      {ok && (
        <div className="border-l-2 border-green bg-green/5 text-green text-sm px-3 py-2">
          {ok}
        </div>
      )}
      <PrimaryButton type="submit" disabled={submitting}>
        {submitting ? "Saving…" : "Change password"}
      </PrimaryButton>
    </Form>
  );
}
