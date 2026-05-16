import { desc } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-posts";
import { db } from "~/db.server";
import { posts } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
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
  return [{ title: "News & posts · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const all = await db
    .select()
    .from(posts)
    .orderBy(desc(posts.updatedAt));
  return { posts: all };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (intent === "delete") {
    const { eq } = await import("drizzle-orm");
    await db.delete(posts).where(eq(posts.id, id));
  }
  return { ok: true };
}

export default function AdminPostsList({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  return (
    <AdminPage
      eyebrow="Content"
      title="News & posts"
      description="Write, edit and publish stories from the club. Drafts stay invisible until you hit publish."
      actions={<LinkButton to="/admin/posts/new">+ New post</LinkButton>}
    >
      {posts.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No posts yet.</div>
          <p className="mt-2 text-mute text-sm">
            Write the first one — the news page on the public site updates the
            moment you publish.
          </p>
          <div className="mt-5">
            <LinkButton to="/admin/posts/new">Write the first post</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th className="w-full">Title</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {posts.map((p) => (
            <tr key={p.id} className="hover:bg-paper-warm/40">
              <Td>
                <Link
                  to={`/admin/posts/${p.id}/edit`}
                  className="font-medium text-navy hover:text-sky-bright"
                >
                  {p.title || "(untitled)"}
                </Link>
                <div className="text-xs text-mute mt-0.5">/news/{p.slug}</div>
              </Td>
              <Td>
                {p.status === "published" ? (
                  <StatusPill status="ok" label="Published" />
                ) : (
                  <StatusPill status="draft" label="Draft" />
                )}
              </Td>
              <Td className="text-mute text-xs whitespace-nowrap">
                {p.updatedAt.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  {p.status === "published" && (
                    <Link
                      to={`/news/${p.slug}`}
                      target="_blank"
                      className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
                    >
                      View ↗
                    </Link>
                  )}
                  <Link
                    to={`/admin/posts/${p.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Delete "${p.title}"?`)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      Delete
                    </DangerButton>
                  </Form>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </AdminPage>
  );
}
