import { redirect } from "react-router";
import type { Route } from "./+types/api.partnership-eoi";
import { db } from "~/db.server";
import { contactMessages } from "../../db/schema";
import { sendContactNotification } from "~/lib/email.server";

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const contact = String(formData.get("contact") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const pkg = String(formData.get("package") ?? "").trim();

  if (!contact || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return redirect("/partnership?error=1");
  }

  const messageParts = [
    pkg ? `Package: ${pkg}` : null,
    formData.get("company") ? `Company: ${formData.get("company")}` : null,
    formData.get("position") ? `Position: ${formData.get("position")}` : null,
    formData.get("phone") ? `Phone: ${formData.get("phone")}` : null,
    formData.get("address") ? `Address: ${formData.get("address")}` : null,
    formData.get("notes") ? `\nNotes: ${formData.get("notes")}` : null,
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

  return redirect("/partnership?submitted=1");
}
