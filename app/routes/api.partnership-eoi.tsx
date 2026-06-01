import type { Route } from "./+types/api.partnership-eoi";
import { db } from "~/db.server";
import { contactMessages } from "../../db/schema";
import { sendContactNotification } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: false, error: "Invalid request" }, { status: 400 });
  }

  const contact = String(body.contact ?? "").trim();
  const email = String(body.email ?? "").trim();
  const pkg = String(body.package ?? "").trim();

  if (!contact || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ ok: false, error: "Name and email are required" }, { status: 422 });
  }

  const messageParts = [
    pkg ? `Package: ${pkg}` : null,
    body.company ? `Company: ${body.company}` : null,
    body.position ? `Position: ${body.position}` : null,
    body.phone ? `Phone: ${body.phone}` : null,
    body.address ? `Address: ${body.address}` : null,
    body.notes ? `\nNotes: ${body.notes}` : null,
  ].filter(Boolean);

  const message = messageParts.join("\n");
  const subject = "Sponsor a Player";

  await db.insert(contactMessages).values({
    name: contact,
    email,
    subject,
    message,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await sendContactNotification({ name: contact, email, subject, message });

  return Response.json({ ok: true });
}
