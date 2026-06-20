import { asc, eq } from "drizzle-orm";
import { Form, Link, redirect, useActionData, useLoaderData } from "react-router";
import type { Route } from "./+types/admin-programmes-edit";
import { db } from "~/db.server";
import { fixtures, media, players, programmes, sponsors } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { AdminBreadcrumbs, AdminPage, DangerButton, PrimaryButton } from "~/components/admin/AdminShell";
import { variantUrl } from "~/lib/uploads";

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
    ? await db.select({ id: media.id, filename: media.filename }).from(media).where(eq(media.id, prog.coverImageMediaId)).limit(1)
    : [null];

  const [featuredPlayer] = prog.featuredPlayerId
    ? await db.select({ id: players.id, name: players.name }).from(players).where(eq(players.id, prog.featuredPlayerId)).limit(1)
    : [null];

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
    .select({ id: media.id, filename: media.filename })
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

  return { saved: null };
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

export default function AdminProgrammesEdit({ loaderData }: Route.ComponentProps) {
  const { prog, fixture, coverImage, featuredPlayer, featuredSponsor, coverSponsor, allPlayers, allSponsors, allMedia } = loaderData;
  const action = useActionData<typeof import("./admin-programmes-edit").action>();
  const saved = action && "saved" in action ? action.saved : null;

  const kickoff = fixture ? new Date(fixture.kickoff) : null;
  const matchTitle = fixture
    ? `DCFC vs ${fixture.opponent} — ${kickoff!.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`
    : "Untitled programme";

  const freeFrom = kickoff ? new Date(kickoff.getTime() + 48 * 60 * 60 * 1000) : null;
  const isLive = prog.status === "published";

  const checkDone = {
    cover: !!prog.coverImageMediaId,
    notes: !!(prog.managersNotes?.trim()),
    player: !!prog.featuredPlayerId,
    opposition: !!(prog.oppositionProfile?.trim()),
  };
  const allDone = Object.values(checkDone).every(Boolean);

  const imageOptions = allMedia.filter((m) => /\.(jpg|jpeg|png|avif|webp)$/i.test(m.filename));

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
              <CheckItem done={checkDone.player} label="Featured player" />
              <CheckItem done={checkDone.opposition} label="Opposition profile" />
            </div>
          </div>

          <div className="border border-line p-4 space-y-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-mute">Status</div>
            {isLive ? (
              <>
                <div className="text-sm text-navy font-medium">Published</div>
                {freeFrom && (
                  <div className="text-xs text-mute">
                    Free from: {freeFrom.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} at {freeFrom.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
                  </div>
                )}
                <Link to={`/programmes/${prog.id}`} target="_blank" className="block text-xs text-sky-deep underline">
                  View programme ↗
                </Link>
                <Form method="post">
                  <input type="hidden" name="intent" value="unpublish" />
                  <DangerButton type="submit">Unpublish</DangerButton>
                </Form>
              </>
            ) : (
              <>
                <div className="text-sm text-mute">Draft — not visible to supporters</div>
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
              <div className="mb-4 h-32 w-48 overflow-hidden border border-line">
                <img src={variantUrl(coverImage.filename, 400, "jpeg")} alt="Cover" className="h-full w-full object-cover" />
              </div>
            )}
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="cover" />
              <div>
                <label className="block text-[10px] uppercase tracking-[0.2em] text-mute mb-1.5">Cover image</label>
                <select name="coverImageMediaId" className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink">
                  <option value="">— None selected —</option>
                  {imageOptions.map((m) => (
                    <option key={m.id} value={m.id} selected={m.id === prog.coverImageMediaId}>
                      {m.filename}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-mute">Upload new images in the <Link to="/admin/media" className="underline">media library</Link> first.</p>
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
          </section>

          {/* Opposition profile */}
          <section className="border border-line p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className={["h-2 w-2 rounded-full", checkDone.opposition ? "bg-sky-deep" : "bg-line"].join(" ")} />
              <h2 className="text-[10px] uppercase tracking-[0.24em] text-mute">Know your enemy — opposition profile</h2>
            </div>
            <SavedBanner intent="opposition" saved={saved ?? null} />
            <Form method="post" className="space-y-4">
              <input type="hidden" name="intent" value="opposition" />
              <textarea
                name="oppositionProfile"
                rows={8}
                defaultValue={prog.oppositionProfile ?? ""}
                placeholder={`A profile of ${fixture?.opponent ?? "the opposition"} — recent form, key players, history against DCFC...`}
                className="w-full bg-paper border border-line focus:border-navy outline-none px-4 py-3 text-base text-ink resize-y"
              />
              <PrimaryButton type="submit">Save profile</PrimaryButton>
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
