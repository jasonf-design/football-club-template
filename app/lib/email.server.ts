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

export type DonationInterestNotification = {
  name: string;
  email: string;
  amountPence: number;
};

export async function sendDonationInterestNotification(
  msg: DonationInterestNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const amount = `£${(msg.amountPence / 100).toFixed(2)}`;

  const subjectLine = `Club donation interest from ${msg.name} (${amount})`;

  const text = [
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    `Intended donation: ${amount}`,
    "",
    "Online payments are not set up yet — contact this supporter to arrange their donation.",
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 20px;font-size:18px;color:#0a1628">New club donation enquiry</h2>
  <p style="margin:0 0 10px"><strong>Name:</strong> ${esc(msg.name)}</p>
  <p style="margin:0 0 10px"><strong>Email:</strong> <a href="mailto:${esc(msg.email)}" style="color:#0066cc">${esc(msg.email)}</a></p>
  <p style="margin:0 0 20px"><strong>Intended donation:</strong> ${amount}</p>
  <div style="padding:14px 16px;background:#f0f7ff;border-left:3px solid #4a90d9;font-size:14px;color:#444">
    Online payments are not yet set up — reply to this email to arrange the donation with this supporter.
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      replyTo: msg.email,
      subject: subjectLine,
      text,
      html,
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

export type PlayerSponsorInterestNotification = {
  sponsorName: string;
  sponsorEmail: string;
  playerName: string;
  pricePence: number;
};

export async function sendPlayerSponsorInterestNotification(
  msg: PlayerSponsorInterestNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;

  const subjectLine = `Player sponsorship interest: ${msg.sponsorName} wants to sponsor ${msg.playerName}`;

  const text = [
    `Sponsor name: ${msg.sponsorName}`,
    `Sponsor email: ${msg.sponsorEmail}`,
    `Player: ${msg.playerName}`,
    `Amount: £${(msg.pricePence / 100).toFixed(2)}`,
    "",
    "Online payments are not set up yet — reply to this email to arrange payment with this supporter.",
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 20px;font-size:18px;color:#0a1628">New player sponsorship enquiry</h2>
  <p style="margin:0 0 10px"><strong>Sponsor name:</strong> ${esc(msg.sponsorName)}</p>
  <p style="margin:0 0 10px"><strong>Sponsor email:</strong> <a href="mailto:${esc(msg.sponsorEmail)}" style="color:#0066cc">${esc(msg.sponsorEmail)}</a></p>
  <p style="margin:0 0 10px"><strong>Player:</strong> ${esc(msg.playerName)}</p>
  <p style="margin:0 0 20px"><strong>Amount:</strong> £${(msg.pricePence / 100).toFixed(2)}</p>
  <div style="padding:14px 16px;background:#f0f7ff;border-left:3px solid #4a90d9;font-size:14px;color:#444">
    Online payments are not yet set up — reply to this email to arrange payment with this supporter.
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      replyTo: msg.sponsorEmail,
      subject: subjectLine,
      text,
      html,
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

export type PitchInterestNotification = {
  name: string;
  email: string;
  displayName: string;
  squareCount: number;
  squareIds: number[];
};

export async function sendPitchInterestNotification(
  msg: PitchInterestNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;

  const subjectLine = `Pitch square interest from ${msg.name} (${msg.squareCount} square${msg.squareCount === 1 ? "" : "s"})`;

  const text = [
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    `Display name on pitch: ${msg.displayName}`,
    `Squares requested: ${msg.squareCount}`,
    `Square IDs: ${msg.squareIds.join(", ")}`,
    "",
    "Online payments are not set up yet — reply to this email to arrange payment with this supporter.",
  ].join("\n");

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 20px;font-size:18px;color:#0a1628">New pitch sponsorship enquiry</h2>
  <p style="margin:0 0 10px"><strong>Name:</strong> ${esc(msg.name)}</p>
  <p style="margin:0 0 10px"><strong>Email:</strong> <a href="mailto:${esc(msg.email)}" style="color:#0066cc">${esc(msg.email)}</a></p>
  <p style="margin:0 0 10px"><strong>Display name on pitch:</strong> ${esc(msg.displayName)}</p>
  <p style="margin:0 0 10px"><strong>Squares requested:</strong> ${msg.squareCount}</p>
  <p style="margin:0 0 20px"><strong>Square IDs:</strong> ${msg.squareIds.join(", ")}</p>
  <div style="padding:14px 16px;background:#f0f7ff;border-left:3px solid #4a90d9;font-size:14px;color:#444">
    Online payments are not yet set up — reply to this email to arrange payment with this supporter.
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({
      from,
      to,
      replyTo: msg.email,
      subject: subjectLine,
      text,
      html,
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
