import { asc, eq } from "drizzle-orm";
import type { Route } from "./+types/team";
import { db } from "~/db.server";
import { media, players } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { uploadUrlFor } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "First Team · Doncaster City FC" },
    {
      name: "description",
      content: "Meet the players representing Doncaster City this season.",
    },
  ];
}

export async function loader() {
  const squad = await db
    .select({
      id: players.id,
      name: players.name,
      position: players.position,
      shirtNumber: players.shirtNumber,
      bio: players.bio,
      photoFilename: media.filename,
    })
    .from(players)
    .leftJoin(media, eq(media.id, players.photoMediaId))
    .where(eq(players.active, true))
    .orderBy(asc(players.sortOrder), asc(players.name));
  return { squad };
}

export default function Team({ loaderData }: Route.ComponentProps) {
  const { squad } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="The squad"
        title="First team."
        lede="The eleven who'll be wearing navy and sky this season. Every player, every position, every story."
      />
      <Container size="wide" className="py-16">
        {squad.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              Squad announcement coming soon.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              Once the first team is finalised, every player will be introduced
              here with their bio, photo, and shirt number.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-12">
            {squad.map((p) => {
              const photo = uploadUrlFor(p.photoFilename);
              return (
                <article key={p.id} className="group">
                  <div className="aspect-[3/4] bg-navy/5 relative overflow-hidden">
                    {photo ? (
                      <img
                        src={photo}
                        alt={p.name}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/10" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-navy via-navy/30 to-transparent" />
                    {p.shirtNumber != null && (
                      <div className="absolute top-4 right-4 scoreboard text-5xl text-paper/90 leading-none">
                        {p.shirtNumber}
                      </div>
                    )}
                  </div>
                  <div className="pt-4">
                    {p.position && (
                      <div className="text-[10px] uppercase tracking-[0.22em] text-sky-deep">
                        {p.position}
                      </div>
                    )}
                    <h3 className="font-serif text-xl text-navy mt-1 leading-tight">
                      {p.name}
                    </h3>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
