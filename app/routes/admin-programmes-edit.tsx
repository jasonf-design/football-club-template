import { useState, useCallback, useRef } from "react";
import { asc, eq } from "drizzle-orm";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/admin-programmes-edit";
import { db } from "~/db.server";
import { fixtures, media, players, programmes, sponsors } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage, DangerButton, PrimaryButton, SecondaryButton } from "~/components/admin/AdminShell";
import { variantUrl } from "~/lib/uploads";
import { sendLeagueNotification } from "~/lib/email.server";
import { MediaPickerField } from "~/components/admin/MediaPickerField";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Edit Programme · Admin" }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [prog] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.id, params.id))
    .limit(1);
  if (!prog) throw new Response("Not found", { status: 404 });

  const [fixture] = prog.fixtureId
    ? await db.select().from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
    : [null];

  const [coverImage] = prog.coverImageMediaId
    ? await db.select({ id: media.id, filename: media.filename, focalX: media.focalX, focalY: media.focalY }).from(media).where(eq(media.id, prog.coverImageMediaId)).limit(1)
    : [null];

  const [featuredPlayerRow] = prog.featuredPlayerId
    ? await db.select({
        id: players.id, name: players.name,
        photoMediaId: players.photoMediaId,
        spotlightPhotoMediaId: players.spotlightPhotoMediaId,
        spotlightFocalX: players.spotlightFocalX,
        spotlightFocalY: players.spotlightFocalY,
      }).from(players).where(eq(players.id, prog.featuredPlayerId)).limit(1)
    : [null];

  // Resolve the spotlight photo — use spotlightPhotoMediaId if set, else fall back to photoMediaId
  const spotlightMediaId = featuredPlayerRow?.spotlightPhotoMediaId ?? featuredPlayerRow?.photoMediaId ?? null;
  const [spotlightImage] = spotlightMediaId
    ? await db.select({ id: media.id, filename: media.filename, focalX: media.focalX, focalY: media.focalY }).from(media).where(eq(media.id, spotlightMediaId)).limit(1)
    : [null];
  const featuredPlayer = featuredPlayerRow ? { ...featuredPlayerRow, spotlightImage: spotlightImage ?? null } : null;

  const [featuredSponsor] = prog.featuredSponsorId
    ? await db.select({ id: sponsors.id, name: sponsors.name }).from(sponsors).where(eq(sponsors.id, prog.featuredSponsorId)).limit(1)
    : [null];

  const [coverSponsor] = prog.coverSponsorId
    ? await db.select({ id: sponsors.id, name: sponsors.name }).from(sponsors).where(eq(sponsors.id, prog.coverSponsorId)).limit(1)
    : [null];

  const allPlayers = await db
    .select({ id: players.id, name: players.name, team: players.team })
    .from(players)
    .where(eq(players.active, true))
    .orderBy(asc(players.team), asc(players.sortOrder), asc(players.name));

  const allSponsors = await db
    .select({ id: sponsors.id, name: sponsors.name, tier: sponsors.tier })
    .from(sponsors)
    .where(eq(sponsors.active, true))
    .orderBy(asc(sponsors.sortOrder), asc(sponsors.name));

  const allMedia = await db
    .select({ id: media.id, filename: media.filename, originalName: media.originalName, width: media.width, height: media.height })
    .from(media)
    .orderBy(asc(media.createdAt));

  return { prog, fixture, coverImage, featuredPlayer, featuredSponsor, coverSponsor, allPlayers, allSponsors, allMedia };
}

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "cover") {
    const coverImageMediaId = form.get("coverImageMediaId");
    const coverSponsorId = form.get("coverSponsorId");
    await db.update(programmes).set({
      coverImageMediaId: typeof coverImageMediaId === "string" && coverImageMediaId ? coverImageMediaId : null,
      coverSponsorId: typeof coverSponsorId === "string" && coverSponsorId ? coverSponsorId : null,
    }).where(eq(programmes.id, params.id));
    return { saved: "cover" };
  }

  if (intent === "managers-notes") {
    await db.update(programmes).set({ managersNotes: String(form.get("managersNotes") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "managers-notes" };
  }

  if (intent === "chairmans-notes") {
    await db.update(programmes).set({ chairmansNotes: String(form.get("chairmansNotes") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "chairmans-notes" };
  }

  if (intent === "blakes-thoughts") {
    await db.update(programmes).set({ blakesThoughts: String(form.get("blakesThoughts") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "blakes-thoughts" };
  }

  if (intent === "featured-player") {
    const featuredPlayerId = form.get("featuredPlayerId");
    await db.update(programmes).set({
      featuredPlayerId: typeof featuredPlayerId === "string" && featuredPlayerId ? featuredPlayerId : null,
    }).where(eq(programmes.id, params.id));
    return { saved: "featured-player" };
  }

  if (intent === "opposition") {
    await db.update(programmes).set({ oppositionProfile: String(form.get("oppositionProfile") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "opposition" };
  }

  if (intent === "opposition-lineup") {
    await db.update(programmes).set({ oppositionLineup: String(form.get("oppositionLineup") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "opposition-lineup" };
  }

  if (intent === "spotlight-photo") {
    const [progRecord] = await db.select({ featuredPlayerId: programmes.featuredPlayerId })
      .from(programmes).where(eq(programmes.id, params.id)).limit(1);
    if (!progRecord?.featuredPlayerId) return { saved: null };
    const spotlightPhotoMediaId = form.get("spotlightPhotoMediaId");
    await db.update(players).set({
      spotlightPhotoMediaId: typeof spotlightPhotoMediaId === "string" && spotlightPhotoMediaId ? spotlightPhotoMediaId : null,
    }).where(eq(players.id, progRecord.featuredPlayerId));
    return { saved: "spotlight-photo" };
  }

  if (intent === "opposition-squad") {
    await db.update(programmes).set({ oppositionSquad: String(form.get("oppositionSquad") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "opposition-squad" };
  }

  if (intent === "opposition-management") {
    await db.update(programmes).set({ oppositionManagement: String(form.get("oppositionManagement") ?? "").trim() || null })
      .where(eq(programmes.id, params.id));
    return { saved: "opposition-management" };
  }

  if (intent === "featured-sponsor") {
    const featuredSponsorId = form.get("featuredSponsorId");
    await db.update(programmes).set({
      featuredSponsorId: typeof featuredSponsorId === "string" && featuredSponsorId ? featuredSponsorId : null,
    }).where(eq(programmes.id, params.id));
    return { saved: "featured-sponsor" };
  }

  if (intent === "publish") {
    await db.update(programmes).set({ status: "published" }).where(eq(programmes.id, params.id));
    return { saved: "publish" };
  }

  if (intent === "unpublish") {
    await db.update(programmes).set({ status: "draft" }).where(eq(programmes.id, params.id));
    return { saved: "unpublish" };
  }

  if (intent === "notify-league") {
    const [prog] = await db.select().from(programmes).where(eq(programmes.id, params.id)).limit(1);
    if (!prog || prog.status !== "published") return { saved: null, notifyError: "Programme must be published before notifying the league." };
    const [fixture] = prog.fixtureId
      ? await db.select().from(fixtures).where(eq(fixtures.id, prog.fixtureId)).limit(1)
      : [null];
    const publicUrl = process.env.PUBLIC_URL ?? "https://doncastercity-fc.com";
    const programmeUrl = `${publicUrl}/programmes/${prog.id}`;
    const programmeTitle = fixture ? `DCFC vs ${fixture.opponent}` : "DCFC Programme";
    const matchDate = fixture
      ? new Date(fixture.kickoff).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
      : "";
    const result = await sendLeagueNotification({
      programmeTitle,
      programmeUrl,
      matchDate,
      competition: fixture?.competition ?? "",
    });
    if (result.sent) {
      await db.update(programmes).set({ leagueNotifiedAt: new Date() }).where(eq(programmes.id, params.id));
      return { saved: "notify-league" };
    }
    return { saved: null, notifyError: "Email failed to send — check Resend is configured." };
  }

  return { saved: null };
}

function InlineFocalPicker({ mediaId, src, initialX, initialY }: {
  mediaId: string; src: string; initialX: number; initialY: number;
}) {
  const [focal, setFocal] = useState({ x: initialX, y: initialY });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setFocal({ x, y });
    setStatus("saving");
    try {
      await fetch("/admin/api/focal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mediaId, focalX: x, focalY: y }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("idle");
    }
  }, [mediaId]);

  return (
    <div className="mb-6">
      <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-2">
        Cover crop preview &mdash; <span className="normal-case tracking-normal text-mute/70">click to reposition</span>
      </div>
      <div
        className="relative cursor-crosshair select-none overflow-hidden border border-line"
        style={{ width: 192, height: 272 }}
        onClick={handleClick}
      >
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          style={{ objectPosition: `${focal.x * 100}% ${focal.y * 100}%` }}
          draggable={false}
        />
        <div
          className="absolute pointer-events-none"
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)] bg-white/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-px h-5 bg-white opacity-80" style={{ position: "absolute" }} />
            <div className="h-px w-5 bg-white opacity-80" style={{ position: "absolute" }} />
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-mute h-4">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : `Focal: ${Math.round(focal.x * 100)}% across · ${Math.round(focal.y * 100)}% down`}
      </div>
    </div>
  );
}

function SpotlightFocalPicker({ playerId, src, initialX, initialY }: {
  playerId: string; src: string; initialX: number; initialY: number;
}) {
  const [focal, setFocal] = useState({ x: initialX, y: initialY });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setFocal({ x, y });
    setStatus("saving");
    try {
      await fetch("/admin/api/player-spotlight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: playerId, focalX: x, focalY: y }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("idle");
    }
  }, [playerId]);

  return (
    <div className="mb-4">
      <div className="text-[10px] uppercase tracking-[0.2em] text-mute mb-2">
        Spotlight crop &mdash; <span className="normal-case tracking-normal text-mute/70">click to reposition</span>
      </div>
      <div
        className="relative cursor-crosshair select-none overflow-hidden border border-line"
        style={{ width: 160, height: 240 }}
        onClick={handleClick}
      >
        <img
          src={src}
          alt=""
          className="absolute inset-0 h-full w-full object-cover pointer-events-none"
          style={{ objectPosition: `${focal.x * 100}% ${focal.y * 100}%` }}
          draggable={false}
        />
        <div
          className="absolute pointer-events-none"
          style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%`, transform: "translate(-50%, -50%)" }}
        >
          <div className="w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)] bg-white/20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-px h-5 bg-white opacity-80" style={{ position: "absolute" }} />
            <div className="h-px w-5 bg-white opacity-80" style={{ position: "absolute" }} />
          </div>
        </div>
      </div>
      <div className="mt-1.5 text-xs text-mute h-4">
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved ✓" : `${Math.round(focal.x * 100)}% across · ${Math.round(focal.y * 100)}% down`}
      </div>
    </div>
  );
}

function CheckItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className={["flex items-center gap-3 px-4 py-3 border", done ? "border-sky-deep/30 bg-sky/5" : "border-line bg-paper"].join(" ")}>
      <div className={["h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0", done ? "bg-sky-deep text-paper" : "border-2 border-line text-transparent"].join(" ")}>
        ✓
      </div>
      <span className={["text-sm", done ? "text-navy" : "text-mute"].join(" ")}>{label}</span>
    </div>
  );
}

function SavedBanner({ intent, saved }: { intent: string; saved: string | null }) {
  if (saved !== intent) return null;
  return <div className="mb-4 bg-sky/10 border border-sky-deep/30 px-4 py-2 text-sm text-sky-deep">Saved.</div>;
}

function OppositionSection({
  prog,
  fixture,
  saved,
}: {
  prog: { id: string; oppositionProfile: string | null; oppositionManagement: string | null; oppositionSquad: string | null };
  fixture: { opponent: string } | null;
  saved: string | null;
}) {
  const profileRef = useRef<HTMLTextAreaElement>(null);
  const managementRef = useRef<HTMLTextAreaElement>(null);
  const squadRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [wikiState, setWikiState] = useState<"idle" | "loading" | "error">("idle");
  const [uploadState, setUploadState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [extracted, setExtracted] = useState<{ profile: string; management: string; squad: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");

  async function fetchFromWikipedia() {
    if (!fixture?.opponent) return;
    setWikiState("loading");
    try {
      const res = await fetch(`/admin/api/wikipedia?q=${encodeURIComponent(fixture.opponent)}`);
      if (!res.ok) throw new Error();
      const data = await res.json() as { text: string };
      if (profileRef.current) profileRef.current.value = data.text;
      setWikiState("idle");
    } catch {
      setWikiState("error");
      setTimeout(() => setWikiState("idle"), 3000);
    }
  }

  async function handleFileUpload(file: File) {
    setUploadState("loading");
    setExtracted(null);
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/admin/api/opposition-upload", { method: "POST", body: fd });
      const data = await res.json() as { profile: string; management: string; squad: string; error?: string };
      if (!res.ok) {
        setUploadState("error");
        setErrorMsg(data.error ?? "Failed to read the file.");
        setTimeout(() => setUploadState("idle"), 4000);
        return;
      }
      setExtracted(data);
      setUploadState("done");
    } catch {
      setUploadState("error");
      setErrorMsg("Upload failed — check your connection and try again.");
      setTimeout(() => setUploadState("idle"), 4000);
    }
  }

  return (
    <>
      {/* PDF upload section */}
      <section className="border border-line p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-amber-400" />
          <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Upload opposition club material</h2>
        </div>
        <p className="text-xs text-mute mb-4">
          Upload whatever {fixture?.opponent ?? "the opposition"} send you — PDF, Word document, Excel spreadsheet, or plain text. We'll extract the profile and squad automatically.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileUpload(file);
            e.target.value = "";
          }}
        />
        {uploadState === "idle" && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-xs text-sky-deep underline underline-offset-2"
          >
            Choose file to upload
          </button>
        )}
        {uploadState === "loading" && (
          <span className="text-xs text-mute">Reading file…</span>
        )}
        {uploadState === "error" && (
          <span className="text-xs text-red-600">{errorMsg || "Failed to read the file — try a different format."}</span>
        )}
        {uploadState === "done" && extracted && (
          <div className="space-y-3">
            <div className="text-xs text-green-700 font-medium">File parsed — ready to apply</div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button
                type="button"
                onClick={() => {
                  if (profileRef.current) profileRef.current.value = extracted.profile;
                  if (managementRef.current) managementRef.current.value = extracted.management;
                  if (squadRef.current) squadRef.current.value = extracted.squad;
                }}
                className="text-xs bg-sky-deep text-paper px-3 py-1.5"
              >
                Apply all
              </button>
              <button
                type="button"
                onClick={() => { if (profileRef.current) profileRef.current.value = extracted.profile; }}
                className="text-xs text-sky-deep underline underline-offset-2"
              >
                Profile only
              </button>
              <button
                type="button"
                onClick={() => {
                  if (managementRef.current) managementRef.current.value = extracted.management;
                  if (squadRef.current) squadRef.current.value = extracted.squad;
                }}
                className="text-xs text-sky-deep underline underline-offset-2"
              >
                Squad &amp; management only
              </button>
              <button
                type="button"
                onClick={() => { setExtracted(null); setUploadState("idle"); }}
                className="text-xs text-mute underline underline-offset-2"
              >
                Clear
              </button>
            </div>
            <p className="text-[11px] text-mute">Save each section after applying.</p>
          </div>
        )}
      </section>

      {/* Opposition profile */}
      <section className="border border-line p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={["h-2 w-2 rounded-full", prog.oppositionProfile?.trim() ? "bg-sky-deep" : "bg-line"].join(" ")} />
          <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Know your enemy — opposition profile</h2>
        </div>
        <SavedBanner intent="opposition" saved={saved} />
        {fixture && (
          <div className="mb-3">
            <button
              type="button"
              onClick={fetchFromWikipedia}
              disabled={wikiState === "loading"}
              className="text-xs text-sky-deep underline underline-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {wikiState === "loading" ? "Fetching from Wikipedia…" : wikiState === "error" ? "Not found on Wikipedia — try manually" : "Auto-fill from Wikipedia"}
            </button>
          </div>
        )}
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="opposition" />
          <textarea
            ref={profileRef}
            name="oppositionProfile"
            rows={8}
            defaultValue={prog.oppositionProfile ?? ""}
            placeholder={`A profile of ${fixture?.opponent ?? "the opposition"} — recent form, key players, history against DCFC...`}
            className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink resize-y"
          />
          <PrimaryButton type="submit">Save profile</PrimaryButton>
        </Form>
      </section>

      {/* Opposition management */}
      <section className="border border-line p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={["h-2 w-2 rounded-full", prog.oppositionManagement?.trim() ? "bg-sky-deep" : "bg-line"].join(" ")} />
          <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Opposition management (optional)</h2>
        </div>
        <SavedBanner intent="opposition-management" saved={saved} />
        <p className="text-xs text-mute mb-3">One entry per line in "Role: Name" format — e.g. "Manager: John Smith".</p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="opposition-management" />
          <textarea
            ref={managementRef}
            name="oppositionManagement"
            rows={6}
            defaultValue={prog.oppositionManagement ?? ""}
            placeholder={"Manager: John Smith\nAssistant Manager: Jane Doe\nCoach: Bob Jones"}
            className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-sm text-ink font-mono resize-y"
          />
          <PrimaryButton type="submit">Save management</PrimaryButton>
        </Form>
      </section>

      {/* Opposition squad */}
      <section className="border border-line p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className={["h-2 w-2 rounded-full", prog.oppositionSquad?.trim() ? "bg-sky-deep" : "bg-line"].join(" ")} />
          <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Opposition squad (optional)</h2>
        </div>
        <SavedBanner intent="opposition-squad" saved={saved} />
        <p className="text-xs text-mute mb-3">One player name per line.</p>
        <Form method="post" className="space-y-4">
          <input type="hidden" name="intent" value="opposition-squad" />
          <textarea
            ref={squadRef}
            name="oppositionSquad"
            rows={14}
            defaultValue={prog.oppositionSquad ?? ""}
            placeholder={"Player One\nPlayer Two\nPlayer Three"}
            className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-sm text-ink font-mono resize-y"
          />
          <PrimaryButton type="submit">Save squad</PrimaryButton>
        </Form>
      </section>
    </>
  );
}

export default function AdminProgrammesEdit({ loaderData }: Route.ComponentProps) {
  const { prog, fixture, coverImage, featuredPlayer, featuredSponsor, coverSponsor, allPlayers, allSponsors, allMedia } = loaderData;
  const action = useActionData<typeof import("./admin-programmes-edit").action>();
  const saved = action && "saved" in action ? action.saved : null;
  const notifyError = action && "notifyError" in action ? (action as { notifyError: string }).notifyError : null;

  const kickoff = fixture ? new Date(fixture.kickoff) : null;
  const matchTitle = fixture
    ? `DCFC vs ${fixture.opponent} — ${kickoff!.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "Untitled programme";

  const isLive = prog.status === "published";

  const isNcelGame = fixture
    ? fixture.competition.toLowerCase().includes("northern counties") || fixture.competition.toLowerCase().includes("ncel")
    : false;
  const isLeagueCup = fixture
    ? fixture.competition.toLowerCase().includes("cup")
    : false;

  const checkDone = {
    cover: !!prog.coverImageMediaId,
    notes: !!(prog.managersNotes?.trim()),
    chairmans: !!(prog.chairmansNotes?.trim()),
    blakes: !!(prog.blakesThoughts?.trim()),
    player: !!prog.featuredPlayerId,
    opposition: !!(prog.oppositionProfile?.trim()),
  };
  const allDone = Object.values(checkDone).every(Boolean);

  const imageOptions = allMedia.filter((m) => /\.(jpg|jpeg|png|avif|webp)$/i.test(m.filename)).reverse();

  return (
    <AdminPage eyebrow="Programmes" title={matchTitle}>
      <AdminBreadcrumbs items={[{ label: "Programmes", to: "/admin/programmes" }, { label: "Edit" }]} />

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-8">
        {/* Left: checklist + publish */}
        <div className="space-y-4">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-3">Checklist</div>
            <div className="space-y-2">
              <CheckItem done={checkDone.cover} label="Cover image" />
              <CheckItem done={checkDone.notes} label="Manager's notes" />
              <CheckItem done={checkDone.chairmans} label="Chairman's notes" />
              <CheckItem done={checkDone.blakes} label="Blake's thoughts" />
              <CheckItem done={checkDone.player} label="Featured player" />
              <CheckItem done={checkDone.opposition} label="Opposition profile" />
            </div>
          </div>

          <div className="border border-line p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-mute">Status</div>
            {isLive ? (
              <>
                <div className="text-sm text-navy font-medium">Published — live now</div>
                <Link to={`/programmes/${prog.id}`} target="_blank" className="block text-xs text-sky-deep underline">
                  View programme ↗
                </Link>
                <Link to={`/programmes/${prog.id}?preview=1`} target="_blank" className="block text-xs text-amber-600 underline">
                  Preview as brochure ↗
                </Link>
                <Form method="post">
                  <input type="hidden" name="intent" value="unpublish" />
                  <DangerButton type="submit">Unpublish</DangerButton>
                </Form>
              </>
            ) : (
              <>
                <div className="text-sm text-mute">Draft — not visible to supporters</div>
                <Link to={`/programmes/${prog.id}?preview=1`} target="_blank" className="block text-xs text-amber-600 underline">
                  Preview as brochure ↗
                </Link>
                {!allDone && (
                  <div className="text-xs text-amber-600">Complete all checklist items before publishing.</div>
                )}
                <Form method="post">
                  <input type="hidden" name="intent" value="publish" />
                  <PrimaryButton type="submit" disabled={!allDone}>
                    Publish programme
                  </PrimaryButton>
                </Form>
              </>
            )}
          </div>

          {isNcelGame && (
            <div className="border border-line p-4 space-y-3">
              <div className="text-[10px] uppercase tracking-[0.24em] text-mute">League notification</div>
              {prog.leagueNotifiedAt ? (
                <>
                  <div className="text-xs text-green-700 font-medium">
                    Sent to Matt Jones ✓
                  </div>
                  <div className="text-xs text-mute">
                    {new Date(prog.leagueNotifiedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <Form method="post">
                    <input type="hidden" name="intent" value="notify-league" />
                    <SecondaryButton type="submit">Resend</SecondaryButton>
                  </Form>
                </>
              ) : (
                <>
                  <div className="text-xs text-mute">
                    NCEL rules require a copy to be sent to Matt Jones within 3 days of the match.
                  </div>
                  {notifyError && <div className="text-xs text-red-600">{notifyError}</div>}
                  {saved === "notify-league" && <div className="text-xs text-green-700">Sent ✓</div>}
                  <Form method="post">
                    <input type="hidden" name="intent" value="notify-league" />
                    <SecondaryButton type="submit" disabled={!isLive}>
                      {isLive ? "Send to Matt Jones" : "Publish first"}
                    </SecondaryButton>
                  </Form>
                  {isLeagueCup && (
                    <div className="text-xs text-amber-600">League Cup — JCP Construction logo required on cover.</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: edit sections */}
        <div className="space-y-8">
          {/* Cover */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.cover ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Cover image &amp; sponsor</h2>
            </div>
            <SavedBanner intent="cover" saved={saved ?? null} />
            {coverImage && (
              <InlineFocalPicker
                mediaId={coverImage.id}
                src={variantUrl(coverImage.filename, 800, "jpeg")!}
                initialX={coverImage.focalX ?? 0.5}
                initialY={coverImage.focalY ?? 0.5}
              />
            )}
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="cover" />
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">Cover image</label>
                <MediaPickerField
                  name="coverImageMediaId"
                  value={prog.coverImageMediaId ?? ""}
                  media={imageOptions}
                />
                <p className="mt-1 text-xs text-mute">Or upload new images in the <Link to="/admin/media" className="underline">media library</Link>.</p>
              </div>
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">Cover sponsor</label>
                <select name="coverSponsorId" className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink">
                  <option value="">— None —</option>
                  {allSponsors.map((s) => (
                    <option key={s.id} value={s.id} selected={s.id === prog.coverSponsorId}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <PrimaryButton type="submit">Save cover</PrimaryButton>
            </Form>
          </section>

          {/* Manager's notes */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.notes ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Manager's notes</h2>
            </div>
            <SavedBanner intent="managers-notes" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="managers-notes" />
              <textarea
                name="managersNotes"
                rows={12}
                defaultValue={prog.managersNotes ?? ""}
                placeholder="A message from the gaffer to supporters..."
                className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink resize-y"
              />
              <PrimaryButton type="submit">Save notes</PrimaryButton>
            </Form>
          </section>

          {/* Chairman's notes */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.chairmans ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Chairman's notes</h2>
            </div>
            <SavedBanner intent="chairmans-notes" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="chairmans-notes" />
              <textarea
                name="chairmansNotes"
                rows={8}
                defaultValue={prog.chairmansNotes ?? ""}
                placeholder="A message from the Chairman, Mark Chappell..."
                className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink resize-y"
              />
              <PrimaryButton type="submit">Save notes</PrimaryButton>
            </Form>
          </section>

          {/* Blake's thoughts */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.blakes ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Blake's thoughts</h2>
            </div>
            <SavedBanner intent="blakes-thoughts" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="blakes-thoughts" />
              <textarea
                name="blakesThoughts"
                rows={8}
                defaultValue={prog.blakesThoughts ?? ""}
                placeholder="Thoughts from Blake Campbell, Director of Football..."
                className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink resize-y"
              />
              <PrimaryButton type="submit">Save thoughts</PrimaryButton>
            </Form>
          </section>

          {/* Featured player */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.player ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Featured player</h2>
            </div>
            <SavedBanner intent="featured-player" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="featured-player" />
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">Select player</label>
                <select name="featuredPlayerId" className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink">
                  <option value="">— None selected —</option>
                  {allPlayers.map((p) => (
                    <option key={p.id} value={p.id} selected={p.id === prog.featuredPlayerId}>
                      {p.name} ({p.team === "first" ? "1st Team" : "U23s"})
                    </option>
                  ))}
                </select>
              </div>
              <PrimaryButton type="submit">Save player</PrimaryButton>
            </Form>

            {/* Spotlight photo & crop — only shown when a player is selected */}
            {featuredPlayer && (
              <div className="mt-6 pt-6 border-t border-line space-y-5">
                <div className="text-[10px] uppercase tracking-[0.2em] text-mute">Spotlight photo &amp; crop</div>
                <p className="text-xs text-mute -mt-2">
                  These only affect the player spotlight page in the programme — they don't change the player's photo on the website.
                </p>

                {/* Portrait focal picker */}
                {featuredPlayer.spotlightImage && (
                  <SpotlightFocalPicker
                    key={featuredPlayer.spotlightImage.id}
                    playerId={featuredPlayer.id}
                    src={variantUrl(featuredPlayer.spotlightImage.filename, 400, "jpeg")!}
                    initialX={featuredPlayer.spotlightFocalX ?? 0.5}
                    initialY={featuredPlayer.spotlightFocalY ?? 0.5}
                  />
                )}

                {/* Spotlight photo picker */}
                <SavedBanner intent="spotlight-photo" saved={saved ?? null} />
                <Form method="post" className="space-y-3">
                  <input type="hidden" name="intent" value="spotlight-photo" />
                  <div>
                    <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">
                      Alternate spotlight photo
                      {!featuredPlayer.spotlightPhotoMediaId && (
                        <span className="ml-2 normal-case tracking-normal text-mute/60">(using main player photo)</span>
                      )}
                    </label>
                    <MediaPickerField
                      name="spotlightPhotoMediaId"
                      value={featuredPlayer.spotlightPhotoMediaId ?? ""}
                      media={imageOptions}
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <PrimaryButton type="submit">Save spotlight photo</PrimaryButton>
                    {featuredPlayer.spotlightPhotoMediaId && (
                      <button
                        type="submit"
                        name="spotlightPhotoMediaId"
                        value=""
                        className="text-xs text-mute underline underline-offset-2"
                      >
                        Clear (use main photo)
                      </button>
                    )}
                  </div>
                </Form>
              </div>
            )}
          </section>

          {/* Opposition — upload PDF + profile + squad */}
          <OppositionSection
            prog={prog}
            fixture={fixture}
            saved={saved ?? null}
          />

          {/* Opposition line-up */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-line" />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Opposition line-up (optional)</h2>
            </div>
            <SavedBanner intent="opposition-lineup" saved={saved ?? null} />
            <p className="text-xs text-mute mb-3">Enter opposition players one per line, optionally prefixed with shirt number (e.g. "1 Joe Smith"). These appear on the back-page team sheet.</p>
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="opposition-lineup" />
              <textarea
                name="oppositionLineup"
                rows={18}
                defaultValue={prog.oppositionLineup ?? ""}
                placeholder={`1 Goalkeeper\n2 Right Back\n3 Left Back\n4 Centre Back\n5 Centre Back\n6 Midfielder\n7 Right Wing\n8 Midfielder\n9 Striker\n10 Attacking Mid\n11 Left Wing`}
                className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-sm text-ink font-mono resize-y"
              />
              <PrimaryButton type="submit">Save line-up</PrimaryButton>
            </Form>
          </section>

          {/* Sponsor spotlight */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-2 w-2 rounded-full bg-line" />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Sponsor spotlight (optional)</h2>
            </div>
            <SavedBanner intent="featured-sponsor" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="featured-sponsor" />
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">Featured sponsor this week</label>
                <select name="featuredSponsorId" className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink">
                  <option value="">— None (auto-select) —</option>
                  {allSponsors.map((s) => (
                    <option key={s.id} value={s.id} selected={s.id === prog.featuredSponsorId}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-mute">If left blank, a sponsor is picked automatically.</p>
              </div>
              <PrimaryButton type="submit">Save sponsor</PrimaryButton>
            </Form>
          </section>
        </div>
      </div>
    </AdminPage>
  );
}
