import "dotenv/config";
import { Resend } from "resend";

let _resend: Resend | null = null;

export function isResendConfigured(): boolean {
  return !!(
    process.env.RESEND_API_KEY &&
    process.env.CONTACT_NOTIFY_TO &&
    process.env.CONTACT_NOTIFY_FROM
  );
}

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set");
  _resend = new Resend(key);
  return _resend;
}

export type ContactNotification = {
  name: string;
  email: string;
  subject: string | null;
  message: string;
};

export type NotificationResult =
  | { sent: true }
  | { sent: false; reason: "unconfigured" | "error"; error?: string };

export async function sendContactNotification(
  msg: ContactNotification,
): Promise<NotificationResult> {
  if (!isResendConfigured()) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = process.env.CONTACT_NOTIFY_TO!;
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const publicUrl = process.env.PUBLIC_URL ?? "";
  const adminUrl = publicUrl
    ? `${publicUrl.replace(/\/$/, "")}/admin/messages`
    : "/admin/messages";

  const subjectLine = msg.subject
    ? `New contact message: ${msg.subject}`
    : `New contact message from ${msg.name}`;

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      replyTo: msg.email,
      subject: subjectLine,
      text: buildPlainBody(msg, adminUrl),
      html: buildHtmlBody(msg, adminUrl),
    });
    if (error) {
      console.error("[email] resend rejected:", error);
      return { sent: false, reason: "error", error: String(error) };
    }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend threw:", err);
    return {
      sent: false,
      reason: "error",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function buildPlainBody(msg: ContactNotification, adminUrl: string) {
  return [
    `From: ${msg.name} <${msg.email}>`,
    msg.subject ? `Subject: ${msg.subject}` : null,
    "",
    msg.message,
    "",
    "—",
    `Reply directly to this email to respond to the sender.`,
    `View in admin: ${adminUrl}`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

function buildHtmlBody(msg: ContactNotification, adminUrl: string) {
  const esc = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  return `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <p style="margin:0 0 16px"><strong>From:</strong> ${esc(msg.name)} &lt;<a href="mailto:${esc(msg.email)}">${esc(msg.email)}</a>&gt;</p>
  ${msg.subject ? `<p style="margin:0 0 16px"><strong>Subject:</strong> ${esc(msg.subject)}</p>` : ""}
  <div style="white-space:pre-wrap;border-left:3px solid #ddd;padding:0 0 0 12px;margin:16px 0">${esc(msg.message)}</div>
  <p style="margin:24px 0 0;font-size:13px;color:#666">
    Reply to this email to respond directly. ·
    <a href="${esc(adminUrl)}">View in admin</a>
  </p>
</div>`;
}
