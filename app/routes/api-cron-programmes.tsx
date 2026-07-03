import { and, asc, gte, inArray, lte } from "drizzle-orm";
import { data } from "react-router";
import type { Route } from "./+types/api-cron-programmes";
import { db } from "~/db.server";
import { fixtures, programmes } from "../../db/schema";
import { Resend } from "resend";

export async function action({ request }: Route.ActionArgs) {
  // Auth check
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get("Authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return data({ error: "Unauthorized" }, { status: 401 });
  }

  if (request.method !== "POST") {
    return data({ error: "Method not allowed" }, { status: 405 });
  }

  const now = new Date();
  const in14Days = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Find upcoming home NCEL league/cup fixtures in the next 14 days
  const upcomingNcelFixtures = await db
    .select()
    .from(fixtures)
    .where(
      and(
        gte(fixtures.kickoff, now),
        lte(fixtures.kickoff, in14Days),
      )
    )
    .orderBy(asc(fixtures.kickoff));

  const ncelFixtures = upcomingNcelFixtures.filter(
    (f) =>
      f.homeAway === "home" &&
      (f.competition.toLowerCase().includes("northern counties east") ||
        f.competition.toLowerCase().includes("ncel")),
  );

  if (ncelFixtures.length === 0) {
    await sendSummaryEmail([], [], now);
    return data({ message: "No upcoming home NCEL fixtures in the next 14 days.", created: [], needsWork: [] });
  }

  const fixtureIds = ncelFixtures.map((f) => f.id);

  // Find which ones already have programmes
  const existingProgrammes = await db
    .select()
    .from(programmes)
    .where(inArray(programmes.fixtureId, fixtureIds));

  const existingByFixtureId = new Map(existingProgrammes.map((p) => [p.fixtureId, p]));

  // Create draft programmes for fixtures that don't have one
  const created: Array<{ fixtureId: string; opponent: string; kickoff: Date; programmeId: string }> = [];

  for (const fixture of ncelFixtures) {
    if (!existingByFixtureId.has(fixture.id)) {
      const [newProg] = await db
        .insert(programmes)
        .values({ fixtureId: fixture.id })
        .returning({ id: programmes.id });
      created.push({
        fixtureId: fixture.id,
        opponent: fixture.opponent,
        kickoff: fixture.kickoff,
        programmeId: newProg.id,
      });
      existingByFixtureId.set(fixture.id, { ...newProg, fixtureId: fixture.id, status: "draft", coverImageMediaId: null, managersNotes: null, oppositionProfile: null, oppositionLineup: null, featuredPlayerId: null, featuredSponsorId: null, coverSponsorId: null, leagueNotifiedAt: null, createdAt: now, updatedAt: now });
    }
  }

  // Check existing drafts for missing checklist items
  const needsWork: Array<{
    opponent: string;
    kickoff: Date;
    programmeId: string;
    missing: string[];
  }> = [];

  for (const fixture of ncelFixtures) {
    const prog = existingByFixtureId.get(fixture.id);
    if (!prog || prog.status === "published") continue;
    const missing: string[] = [];
    if (!prog.coverImageMediaId) missing.push("Cover image");
    if (!prog.managersNotes?.trim()) missing.push("Manager's notes");
    if (!prog.featuredPlayerId) missing.push("Featured player");
    if (!prog.oppositionProfile?.trim()) missing.push("Opposition profile");
    if (missing.length > 0) {
      needsWork.push({
        opponent: fixture.opponent,
        kickoff: fixture.kickoff,
        programmeId: prog.id,
        missing,
      });
    }
  }

  await sendSummaryEmail(created, needsWork, now);

  return data({ created: created.map((c) => c.programmeId), needsWork: needsWork.map((n) => n.programmeId) });
}

async function sendSummaryEmail(
  created: Array<{ opponent: string; kickoff: Date; programmeId: string }>,
  needsWork: Array<{ opponent: string; kickoff: Date; programmeId: string; missing: string[] }>,
  now: Date,
) {
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.CONTACT_NOTIFY_FROM;
  const publicUrl = (process.env.PUBLIC_URL ?? "https://doncastercity-fc.com").replace(/\/$/, "");
  if (!resendKey || !from) return;

  const resend = new Resend(resendKey);
  const hasAnything = created.length > 0 || needsWork.length > 0;

  const fmtDate = (d: Date) =>
    new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });

  const subjectLine = hasAnything
    ? `DCFC Programme check — ${created.length} created, ${needsWork.length} need attention`
    : `DCFC Programme check — no upcoming home NCEL fixtures`;

  let text = `DCFC weekly programme check — ${fmtDate(now)}\n\n`;

  if (created.length > 0) {
    text += `AUTO-CREATED ${created.length} PROGRAMME DRAFT${created.length > 1 ? "S" : ""}:\n`;
    for (const c of created) {
      text += `  • DCFC vs ${c.opponent} (${fmtDate(c.kickoff)})\n`;
      text += `    ${publicUrl}/admin/programmes/${c.programmeId}/edit\n`;
    }
    text += "\n";
  }

  if (needsWork.length > 0) {
    text += `PROGRAMMES NEEDING ATTENTION:\n`;
    for (const n of needsWork) {
      text += `  • DCFC vs ${n.opponent} (${fmtDate(n.kickoff)})\n`;
      text += `    Missing: ${n.missing.join(", ")}\n`;
      text += `    ${publicUrl}/admin/programmes/${n.programmeId}/edit\n`;
    }
    text += "\n";
  }

  if (!hasAnything) {
    text += "No upcoming home NCEL fixtures in the next 14 days — nothing to do.\n";
  }

  text += `\nRemember: the visiting club must send their squad details at least 5 days before the match.\n`;
  text += `Once published, send the programme to Matt Jones (matt.jones@ncel.org.uk) within 3 days.\n`;

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const createdRows = created.map((c) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">DCFC vs ${esc(c.opponent)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${fmtDate(c.kickoff)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><a href="${publicUrl}/admin/programmes/${c.programmeId}/edit" style="color:#0066cc">Edit →</a></td>
    </tr>`
  ).join("");

  const needsWorkRows = needsWork.map((n) =>
    `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">DCFC vs ${esc(n.opponent)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee">${fmtDate(n.kickoff)}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee;color:#c00">${n.missing.map(esc).join(", ")}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #eee"><a href="${publicUrl}/admin/programmes/${n.programmeId}/edit" style="color:#0066cc">Edit →</a></td>
    </tr>`
  ).join("");

  const html = `<div style="font-family:system-ui,sans-serif;color:#111;max-width:640px;line-height:1.5">
  <h2 style="margin:0 0 4px;font-size:18px;color:#0a1628">DCFC Weekly Programme Check</h2>
  <p style="margin:0 0 24px;color:#666;font-size:13px">${fmtDate(now)}</p>

  ${created.length > 0 ? `
  <h3 style="margin:0 0 8px;font-size:14px;color:#0a1628">✅ Auto-created ${created.length} draft programme${created.length > 1 ? "s" : ""}</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
    <thead><tr style="background:#f5f5f5;font-size:11px;text-transform:uppercase;color:#666">
      <th style="padding:8px 12px;text-align:left">Match</th>
      <th style="padding:8px 12px;text-align:left">Date</th>
      <th style="padding:8px 12px;text-align:left">Link</th>
    </tr></thead>
    <tbody>${createdRows}</tbody>
  </table>` : ""}

  ${needsWork.length > 0 ? `
  <h3 style="margin:0 0 8px;font-size:14px;color:#c00">⚠️ ${needsWork.length} programme${needsWork.length > 1 ? "s" : ""} need${needsWork.length === 1 ? "s" : ""} attention</h3>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:14px">
    <thead><tr style="background:#fff8f8;font-size:11px;text-transform:uppercase;color:#666">
      <th style="padding:8px 12px;text-align:left">Match</th>
      <th style="padding:8px 12px;text-align:left">Date</th>
      <th style="padding:8px 12px;text-align:left;color:#c00">Still needed</th>
      <th style="padding:8px 12px;text-align:left">Link</th>
    </tr></thead>
    <tbody>${needsWorkRows}</tbody>
  </table>` : ""}

  ${!hasAnything ? `<p style="color:#666">No upcoming home NCEL fixtures in the next 14 days — nothing to do.</p>` : ""}

  <div style="margin-top:16px;padding:12px 16px;background:#fffbea;border-left:3px solid #f0a500;font-size:13px;color:#555">
    <strong>Reminder:</strong> The visiting club must send their squad details at least 5 days before the match.
    Once published, send a copy to Matt Jones (<a href="mailto:matt.jones@ncel.org.uk">matt.jones@ncel.org.uk</a>) within 3 days.
  </div>
</div>`;

  await resend.emails.send({
    from,
    to: "jason@eko19.com",
    subject: subjectLine,
    text,
    html,
  });
}
