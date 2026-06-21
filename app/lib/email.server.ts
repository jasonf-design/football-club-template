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
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
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

export type DonationPaidNotification = {
  amountPence: number;
};

export async function sendDonationPaidNotification(
  msg: DonationPaidNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const amount = `£${(msg.amountPence / 100).toFixed(2)}`;
  const subjectLine = `✅ Club donation received — ${amount}`;
  const text = `A donation of ${amount} has been received via Stripe.`;
  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0a1628">✅ Club donation received</h2>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Payment confirmed via Stripe</p>
  <p style="font-size:32px;font-weight:700;color:#0a1628;margin:0 0 8px">${amount}</p>
  <p style="color:#555;font-size:14px">Donated to Doncaster City FC</p>
</div>`;
  try {
    const { error } = await getResend().emails.send({ from, to, subject: subjectLine, text, html });
    if (error) { console.error("[email] resend rejected:", error); return { sent: false, reason: "error", error: String(error) }; }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend threw:", err);
    return { sent: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
  }
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
    "Reply to this email to follow up with the supporter.",
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
    Reply to this email to follow up with the supporter.
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

export type ProgrammeInterestNotification = {
  name: string;
  email: string;
  programmeTitle: string;
};

export async function sendProgrammeInterestNotification(
  msg: ProgrammeInterestNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const subjectLine = `Programme interest: ${msg.name} wants to read "${msg.programmeTitle}"`;
  const text = [`Name: ${msg.name}`, `Email: ${msg.email}`, `Programme: ${msg.programmeTitle}`, "", "Follow up to arrange access or wait for the programme to become free 48 hours after the match."].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 20px;font-size:18px;color:#0a1628">New programme interest</h2>
  <p style="margin:0 0 10px"><strong>Name:</strong> ${esc(msg.name)}</p>
  <p style="margin:0 0 10px"><strong>Email:</strong> <a href="mailto:${esc(msg.email)}" style="color:#0066cc">${esc(msg.email)}</a></p>
  <p style="margin:0 0 20px"><strong>Programme:</strong> ${esc(msg.programmeTitle)}</p>
  <div style="padding:14px 16px;background:#f0f7ff;border-left:3px solid #4a90d9;font-size:14px;color:#444">
    The programme becomes free to read 48 hours after the match. You can follow up with this supporter directly in the meantime.
  </div>
</div>`;

  try {
    const { error } = await getResend().emails.send({ from, to, replyTo: msg.email, subject: subjectLine, text, html });
    if (error) { console.error("[email] resend rejected:", error); return { sent: false, reason: "error", error: String(error) }; }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend threw:", err);
    return { sent: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
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
    "They have been sent to Stripe Checkout — payment will be confirmed automatically.",
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
    They have been sent to Stripe Checkout — you will receive a separate confirmation email once payment is complete.
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

export type PitchOrderPaidNotification = {
  name: string;
  email: string;
  displayName: string;
  squareCount: number;
  totalPence: number;
  orderId: string;
};

export async function sendPitchOrderPaidNotification(
  msg: PitchOrderPaidNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const publicUrl = process.env.PUBLIC_URL ?? "";
  const adminUrl = `${publicUrl.replace(/\/$/, "")}/admin/pitch`;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const amount = `£${(msg.totalPence / 100).toFixed(2)}`;
  const subjectLine = `✅ Pitch square payment received — ${msg.displayName} (${amount})`;

  const text = [
    `Payment confirmed for pitch sponsorship.`,
    ``,
    `Name: ${msg.name}`,
    `Email: ${msg.email}`,
    `Display name on pitch: ${msg.displayName}`,
    `Squares: ${msg.squareCount}`,
    `Amount paid: ${amount}`,
    `Order ID: ${msg.orderId}`,
    ``,
    `View in admin: ${adminUrl}`,
  ].join("\n");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0a1628">✅ Pitch square payment received</h2>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Payment confirmed via Stripe</p>
  <p style="margin:0 0 10px"><strong>Name:</strong> ${esc(msg.name)}</p>
  <p style="margin:0 0 10px"><strong>Email:</strong> <a href="mailto:${esc(msg.email)}" style="color:#0066cc">${esc(msg.email)}</a></p>
  <p style="margin:0 0 10px"><strong>Display name on pitch:</strong> ${esc(msg.displayName)}</p>
  <p style="margin:0 0 10px"><strong>Squares:</strong> ${msg.squareCount}</p>
  <p style="margin:0 0 20px"><strong>Amount paid:</strong> ${amount}</p>
  <a href="${esc(adminUrl)}" style="display:inline-block;background:#0a1628;color:#fff;padding:10px 20px;text-decoration:none;font-size:14px;font-weight:600">View in admin →</a>
</div>`;

  try {
    const { error } = await getResend().emails.send({ from, to, subject: subjectLine, text, html });
    if (error) { console.error("[email] resend rejected:", error); return { sent: false, reason: "error", error: String(error) }; }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend threw:", err);
    return { sent: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
  }
}

export type ShopOrderPaidNotification = {
  email: string;
  totalPence: number;
  orderId: string;
  lineItems: Array<{ name: string; qty: number; pricePence: number }>;
};

export async function sendShopOrderPaidNotification(
  msg: ShopOrderPaidNotification,
): Promise<NotificationResult> {
  if (!process.env.RESEND_API_KEY || !process.env.CONTACT_NOTIFY_FROM) {
    return { sent: false, reason: "unconfigured" };
  }
  const to = ["jason.f@DoncasterCity-FC.com", "Mark@DoncasterCity-FC.com"];
  const from = process.env.CONTACT_NOTIFY_FROM!;
  const publicUrl = process.env.PUBLIC_URL ?? "";
  const adminUrl = `${publicUrl.replace(/\/$/, "")}/admin/orders`;
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const amount = `£${(msg.totalPence / 100).toFixed(2)}`;
  const subjectLine = `✅ Shop order paid — ${amount} from ${msg.email}`;

  const itemLines = msg.lineItems.map(
    (li) => `  ${li.qty}x ${li.name} @ £${(li.pricePence / 100).toFixed(2)}`
  ).join("\n");

  const text = [
    `New shop order paid via Stripe.`,
    ``,
    `Customer: ${msg.email}`,
    `Total: ${amount}`,
    `Order ID: ${msg.orderId}`,
    ``,
    `Items:`,
    itemLines,
    ``,
    `View in admin: ${adminUrl}`,
  ].join("\n");

  const itemRows = msg.lineItems.map(
    (li) => `<tr><td style="padding:6px 0;border-bottom:1px solid #eee">${esc(li.name)}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:center">${li.qty}</td><td style="padding:6px 0;border-bottom:1px solid #eee;text-align:right">£${(li.pricePence / 100).toFixed(2)}</td></tr>`
  ).join("");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:560px;line-height:1.5">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0a1628">✅ Shop order paid</h2>
  <p style="margin:0 0 20px;color:#555;font-size:14px">Payment confirmed via Stripe</p>
  <p style="margin:0 0 10px"><strong>Customer:</strong> <a href="mailto:${esc(msg.email)}" style="color:#0066cc">${esc(msg.email)}</a></p>
  <p style="margin:0 0 20px"><strong>Total:</strong> ${amount}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
    <thead><tr style="font-size:12px;text-transform:uppercase;color:#666">
      <th style="text-align:left;padding:6px 0;border-bottom:2px solid #eee">Item</th>
      <th style="text-align:center;padding:6px 0;border-bottom:2px solid #eee">Qty</th>
      <th style="text-align:right;padding:6px 0;border-bottom:2px solid #eee">Price</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <a href="${esc(adminUrl)}" style="display:inline-block;background:#0a1628;color:#fff;padding:10px 20px;text-decoration:none;font-size:14px;font-weight:600">View orders in admin →</a>
</div>`;

  try {
    const { error } = await getResend().emails.send({ from, to, subject: subjectLine, text, html });
    if (error) { console.error("[email] resend rejected:", error); return { sent: false, reason: "error", error: String(error) }; }
    return { sent: true };
  } catch (err) {
    console.error("[email] resend threw:", err);
    return { sent: false, reason: "error", error: err instanceof Error ? err.message : String(err) };
  }
}
