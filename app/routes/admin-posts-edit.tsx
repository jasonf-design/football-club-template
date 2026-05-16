import { and, eq, ne } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData, useSearchParams } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-posts-edit";
import { db } from "~/db.server";
import { media, posts } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { slugify, uniqueSlug } from "~/lib/slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { PostForm } from "~/components/admin/PostForm";
import { uploadUrlFor } from "~/lib/uploads";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit · ${data?.post.title ?? "post"} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [post] = await db
    .select()
    .from(posts)
    .where(eq(posts.id, params.id))
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

const schema = z.object({
  title: z.string().min(2).max(200),
  slug: z.string().max(120).optional(),
  excerpt: z.string().max(500).optional(),
  bodyHtml: z.string().max(200_000).optional(),
  bodyJson: z.string().max(400_000).optional(),
  status: z.enum(["draft", "published"]),
  heroMediaId: z.string().max(64).optional(),
});

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();

  if (form.get("intent") === "delete") {
    await db.delete(posts).where(eq(posts.id, params.id));
    throw redirect("/admin/posts");
  }

  const parsed = schema.safeParse({
    title: form.get("title"),
    slug: form.get("slug") || undefined,
    excerpt: form.get("excerpt") || undefined,
    bodyHtml: form.get("bodyHtml") || undefined,
    bodyJson: form.get("bodyJson") || undefined,
    status: form.get("status") || "draft",
    heroMediaId: form.get("heroMediaId") || undefined,
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }

  const [existing] = await db
    .select({ slug: posts.slug, status: posts.status, publishedAt: posts.publishedAt })
    .from(posts)
    .where(eq(posts.id, params.id))
    .limit(1);
  if (!existing) throw data("Not Found", { status: 404 });

  const title = parsed.data.title.trim();
  let slug = (parsed.data.slug ?? slugify(title)) || slugify(title);
  if (slug !== existing.slug) {
    const taken = await db
      .select({ slug: posts.slug })
      .from(posts)
      .where(and(ne(posts.id, params.id)));
    slug = uniqueSlug(
      slug,
      taken.map((p) => p.slug),
    );
  }

  let bodyJson: unknown = null;
  if (parsed.data.bodyJson) {
    try {
      bodyJson = JSON.parse(parsed.data.bodyJson);
    } catch {
      bodyJson = null;
    }
  }

  const status = parsed.data.status;
  const publishedAt =
    status === "published"
      ? (existing.publishedAt ?? new Date())
      : status === "draft" && existing.status === "published"
        ? existing.publishedAt
        : null;

  await db
    .update(posts)
    .set({
      title,
      slug,
      excerpt: parsed.data.excerpt ?? null,
      bodyHtml: parsed.data.bodyHtml ?? "",
      bodyJson,
      status,
      heroMediaId: parsed.data.heroMediaId || null,
      publishedAt,
    })
    .where(eq(posts.id, params.id));

  return { ok: true, saved: Date.now() };
}

export default function AdminPostsEdit() {
  const { post, heroUrl } = useLoaderData<typeof loader>();
  const action = useActionData<typeof import("./admin-posts-edit").action>();
  const [searchParams] = useSearchParams();
  const justSaved = searchParams.get("saved") === "1" || !!action?.ok;
  return (
    <AdminPage
      eyebrow="Content"
      title={post.title || "Untitled"}
      description={
        justSaved ? "Saved. The public site is updated." : undefined
      }
    >
      <AdminBreadcrumbs
        items={[
          { label: "News & posts", to: "/admin/posts" },
          { label: post.title || "Untitled" },
        ]}
      />
      <PostForm
        initial={{
          id: post.id,
          slug: post.slug,
          title: post.title,
          excerpt: post.excerpt,
          bodyHtml: post.bodyHtml,
          bodyJson: post.bodyJson,
          status: post.status,
          heroMediaId: post.heroMediaId,
          heroUrl,
        }}
        errors={action?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
