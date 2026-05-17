import { and, asc, eq, ne } from "drizzle-orm";
import { Form, Link, useActionData } from "react-router";
import type { Route } from "./+types/admin-users";
import { db } from "~/db.server";
import { users } from "../../db/schema";
import { requireAdminRole } from "~/lib/session.server";
import {
  AdminPage,
  DangerButton,
  LinkButton,
  StatusPill,
  Table,
  Td,
  Th,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Team access · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const me = await requireAdminRole(request);
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.role), asc(users.name));
  return { users: rows, currentUserId: me.id };
}

export async function action({ request }: Route.ActionArgs) {
  const me = await requireAdminRole(request);
  const form = await request.formData();
  const id = String(form.get("id") ?? "");
  if (form.get("intent") !== "delete" || !id) {
    return { error: "Unknown action." };
  }
  if (id === me.id) {
    return { error: "You can't remove your own account." };
  }
  const [target] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, id))
    .limit(1);
  if (!target) return { error: "User not found." };
  if (target.role === "admin") {
    const otherAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), ne(users.id, id)));
    if (otherAdmins.length === 0) {
      return { error: "Can't remove the last admin." };
    }
  }
  await db.delete(users).where(eq(users.id, id));
  return { ok: true };
}

export default function AdminUsersList({ loaderData }: Route.ComponentProps) {
  const { users: rows, currentUserId } = loaderData;
  const data = useActionData<typeof action>();
  return (
    <AdminPage
      eyebrow="Team access"
      title="Users"
      description="People who can sign in to the admin. Admins can manage everyone; editors can edit content."
      actions={<LinkButton to="/admin/users/new">+ Add user</LinkButton>}
    >
      {data?.error && (
        <div className="mb-6 border-l-2 border-red bg-red/5 text-red text-sm px-3 py-2">
          {data.error}
        </div>
      )}
      <Table
        head={
          <>
            <Th className="w-full">User</Th>
            <Th>Role</Th>
            <Th className="text-right">Actions</Th>
          </>
        }
      >
        {rows.map((u) => {
          const isMe = u.id === currentUserId;
          return (
            <tr key={u.id} className="hover:bg-paper-warm/40">
              <Td>
                <div>
                  <Link
                    to={`/admin/users/${u.id}/edit`}
                    className="font-medium text-navy hover:text-sky-bright"
                  >
                    {u.name}
                    {isMe && (
                      <span className="ml-2 text-[10px] uppercase tracking-[0.2em] text-mute">
                        you
                      </span>
                    )}
                  </Link>
                  <div className="text-xs text-mute mt-0.5">{u.email}</div>
                </div>
              </Td>
              <Td>
                {u.role === "admin" ? (
                  <StatusPill status="ok" label="Admin" />
                ) : (
                  <StatusPill status="muted" label="Editor" />
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  <Link
                    to={`/admin/users/${u.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  {!isMe && (
                    <Form method="post">
                      <input type="hidden" name="intent" value="delete" />
                      <input type="hidden" name="id" value={u.id} />
                      <DangerButton
                        type="submit"
                        onClick={(e) => {
                          if (
                            !confirm(
                              `Remove ${u.name} (${u.email})? They will lose access immediately.`,
                            )
                          )
                            e.preventDefault();
                        }}
                      >
                        Remove
                      </DangerButton>
                    </Form>
                  )}
                </div>
              </Td>
            </tr>
          );
        })}
      </Table>
    </AdminPage>
  );
}
