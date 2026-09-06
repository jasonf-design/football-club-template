import { and, eq } from "drizzle-orm";
import { data } from "react-router";
import type { Route } from "./+types/news-article";
import { db } from "~/db.server";
import { media, posts } from "../../db/schema";
import { Container } from "~/components/Container";
import { uploadUrlFor } from "~/lib/uploads";
import { club } from "~/club.config";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.post) return [{ title: `Story not found · ${club.name.short}` }];
  return [
    { title: `${data.post.title} · ${club.name.short}` },
    { name: "description", content: data.post.excerpt ?? undefined },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, params.slug), eq(posts.status, "published")))
    .limit(1);
  if (!post) throw data("Not Found", { status: 404 });
  let heroUrl: string | null = null;
  if (post.heroMediaId) {
    const [m] = await db
      .select({ filename: media.filename })
      .from(media)
      .where(eq(media.id, post.heroMediaId))
      .limit(1);
    heroUrl = uploadUrlFor(m?.filename);
  }
  return { post, heroUrl };
}

export default function NewsArticle({ loaderData }: Route.ComponentProps) {
  const { post, heroUrl } = loaderData;
  const published = post.publishedAt ?? post.createdAt;
  return (
    <article>
      <header className="bg-paper-warm border-b border-line">
        <Container size="default" className="py-16 md:py-24">
          <div className="text-[11px] uppercase tracking-[0.28em] text-sky-deep mb-5">
            {published.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
          <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl text-navy leading-[1.05] tracking-tight text-balance">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-6 text-mute text-xl leading-relaxed max-w-2xl">
              {post.excerpt}
            </p>
          )}
        </Container>
      </header>
      {heroUrl && (
        <div className="bg-navy">
          <Container size="wide" className="py-0">
            <img
              src={heroUrl}
              alt=""
              className="w-full max-h-[60vh] object-cover"
            />
          </Container>
        </div>
      )}
      <Container size="default" className="py-16">
        <div
          className="container-prose mx-auto prose-content"
          dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
        />
      </Container>
    </article>
  );
}
