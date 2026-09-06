import { desc, eq } from "drizzle-orm";
import { Form } from "react-router";
import { club } from "~/club.config";
import type { Route } from "./+types/admin-messages";
import { db } from "~/db.server";
import { contactMessages } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import {
  AdminPage,
  DangerButton,
  StatusPill,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Contact messages · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const all = await db
    .select()
    .from(contactMessages)
    .orderBy(desc(contactMessages.createdAt));
  return { messages: all };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  const intent = form.get("intent");
  if (typeof id !== "string") return { ok: false };
  if (intent === "delete") {
    await db.delete(contactMessages).where(eq(contactMessages.id, id));
  } else if (intent === "handled") {
    await db
      .update(contactMessages)
      .set({ handled: true })
      .where(eq(contactMessages.id, id));
  } else if (intent === "unhandled") {
    await db
      .update(contactMessages)
      .set({ handled: false })
      .where(eq(contactMessages.id, id));
  }
  return { ok: true };
}

export default function AdminMessages({ loaderData }: Route.ComponentProps) {
  const { messages } = loaderData;
  const unhandled = messages.filter((m) => !m.handled).length;
  return (
    <AdminPage
      eyebrow="Inbox"
      title="Contact messages"
      description={
        messages.length === 0
          ? "No messages yet — the contact form on the public site lands here."
          : `${unhandled} unread · ${messages.length} total`
      }
    >
      {messages.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center text-mute">
          The inbox is quiet for now.
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((m) => (
            <article
              key={m.id}
              className={[
                "bg-paper border border-line p-6",
                !m.handled ? "border-l-4 border-l-sky" : "",
              ].join(" ")}
            >
              <header className="flex flex-wrap items-baseline justify-between gap-3 mb-3">
                <div>
                  <div className="font-serif text-xl text-navy">
                    {m.subject || "(no subject)"}
                  </div>
                  <div className="text-xs text-mute mt-1">
                    From{" "}
                    <a
                      href={`mailto:${m.email}`}
                      className="text-navy hover:text-sky-bright underline-offset-4 hover:underline"
                    >
                      {m.name} &lt;{m.email}&gt;
                    </a>{" "}
                    ·{" "}
                    {m.createdAt.toLocaleString("en-GB", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {m.handled ? (
                    <StatusPill status="muted" label="Handled" />
                  ) : (
                    <StatusPill status="warn" label="Unread" />
                  )}
                </div>
              </header>
              <p className="text-ink whitespace-pre-wrap leading-relaxed">
                {m.message}
              </p>
              <footer className="mt-5 flex items-center gap-3">
                <Form method="post">
                  <input type="hidden" name="id" value={m.id} />
                  <input
                    type="hidden"
                    name="intent"
                    value={m.handled ? "unhandled" : "handled"}
                  />
                  <button
                    type="submit"
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright font-medium"
                  >
                    {m.handled ? "Mark as unread" : "Mark as handled"}
                  </button>
                </Form>
                <a
                  href={`mailto:${m.email}?subject=Re: ${encodeURIComponent(m.subject ?? `Your message to ${club.name.short}`)}`}
                  className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
                >
                  Reply by email
                </a>
                <div className="ml-auto">
                  <Form method="post">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="intent" value="delete" />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (!confirm("Delete this message?")) e.preventDefault();
                      }}
                    >
                      Delete
                    </DangerButton>
                  </Form>
                </div>
              </footer>
            </article>
          ))}
        </div>
      )}
    </AdminPage>
  );
}
