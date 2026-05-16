import { desc, eq } from "drizzle-orm";
import type { Route } from "./+types/news-index";
import { db } from "~/db.server";
import { media, posts } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { NewsCard } from "~/components/NewsCard";
import { uploadUrlFor } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "News · Doncaster City FC" },
    {
      name: "description",
      content:
        "Match reports, club announcements, transfer news and stories from Doncaster City FC.",
    },
  ];
}

export async function loader() {
  const rows = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      title: posts.title,
      excerpt: posts.excerpt,
      publishedAt: posts.publishedAt,
      heroFilename: media.filename,
    })
    .from(posts)
    .leftJoin(media, eq(media.id, posts.heroMediaId))
    .where(eq(posts.status, "published"))
    .orderBy(desc(posts.publishedAt));
  return { posts: rows };
}

export default function NewsIndex({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  const [feature, ...rest] = posts;
  return (
    <>
      <PageHeader
        eyebrow="The newsroom"
        title="News from the club."
        lede="Match reports, club announcements, and the stories from behind the scenes."
      />
      <Container size="wide" className="py-16">
        {posts.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              No stories published yet.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              The newsroom is warming up. Once the editor publishes the first
              story, it'll appear here.
            </p>
          </div>
        ) : (
          <>
            {feature && (
              <div className="mb-16">
                <NewsCard
                  slug={feature.slug}
                  title={feature.title}
                  excerpt={feature.excerpt}
                  date={feature.publishedAt ?? new Date()}
                  hero={uploadUrlFor(feature.heroFilename)}
                  size="feature"
                  category="Latest"
                />
              </div>
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
              {rest.map((p) => (
                <NewsCard
                  key={p.slug}
                  slug={p.slug}
                  title={p.title}
                  excerpt={p.excerpt}
                  date={p.publishedAt ?? new Date()}
                  hero={uploadUrlFor(p.heroFilename)}
                />
              ))}
            </div>
          </>
        )}
      </Container>
    </>
  );
}
