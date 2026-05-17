import { eq } from "drizzle-orm";
import {
  Form,
  Link,
  redirect,
  useActionData,
  useNavigation,
} from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-users-new";
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
  return [{ title: "Add user · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdminRole(request);
  return null;
}

const schema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Enter a valid email")
    .max(160),
  name: z.string().trim().min(1, "Name is required").max(120),
  role: z.enum(["admin", "editor"]),
  password: z.string().min(12, "Use at least 12 characters"),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdminRole(request);
  const form = await request.formData();
  const parsed = schema.safeParse({
    email: form.get("email"),
    name: form.get("name"),
    role: form.get("role") ?? "editor",
    password: form.get("password"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "_");
      if (!errors[key]) errors[key] = issue.message;
    }
    return { errors, values: readValues(form) };
  }
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, parsed.data.email))
    .limit(1);
  if (existing) {
    return {
      errors: { email: "A user with that email already exists." },
      values: readValues(form),
    };
  }
  const passwordHash = await hashPassword(parsed.data.password);
  await db.insert(users).values({
    email: parsed.data.email,
    name: parsed.data.name,
    role: parsed.data.role,
    passwordHash,
  });
  throw redirect("/admin/users");
}

function readValues(form: FormData) {
  return {
    email: String(form.get("email") ?? ""),
    name: String(form.get("name") ?? ""),
    role: String(form.get("role") ?? "editor") as "admin" | "editor",
  };
}

export default function AdminUsersNew() {
  const data = useActionData<typeof action>();
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  const errors = data?.errors ?? {};
  const values = data?.values;
  return (
    <AdminPage eyebrow="Team access" title="Add user">
      <AdminBreadcrumbs
        items={[{ label: "Users", to: "/admin/users" }, { label: "New" }]}
      />
      <Form
        method="post"
        className="bg-paper border border-line p-6 lg:p-8 space-y-5 max-w-2xl"
      >
        <FormRow cols={2}>
          <Field name="name" label="Display name" error={errors.name} required>
            <TextInput
              name="name"
              defaultValue={values?.name}
              autoComplete="name"
              required
            />
          </Field>
          <Field name="role" label="Role" error={errors.role}>
            <Select name="role" defaultValue={values?.role ?? "editor"}>
              <option value="editor">Editor</option>
              <option value="admin">Admin</option>
            </Select>
          </Field>
        </FormRow>
        <Field name="email" label="Email" error={errors.email} required>
          <TextInput
            name="email"
            type="email"
            defaultValue={values?.email}
            autoComplete="off"
            required
          />
        </Field>
        <Field
          name="password"
          label="Initial password"
          hint="Min 12 chars · share securely"
          error={errors.password}
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
        <p className="text-xs text-mute">
          Admins can manage users, content and orders. Editors can edit content
          only.
        </p>
        <div className="flex items-center gap-3 pt-1">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Adding…" : "Add user"}
          </PrimaryButton>
          <Link
            to="/admin/users"
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
          >
            Cancel
          </Link>
        </div>
      </Form>
    </AdminPage>
  );
}
