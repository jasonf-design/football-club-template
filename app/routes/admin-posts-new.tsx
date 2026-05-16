import { eq } from "drizzle-orm";
import { redirect } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-posts-new";
import { db } from "~/db.server";
import { posts } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { slugify, uniqueSlug } from "~/lib/slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { PostForm } from "~/components/admin/PostForm";
import { useActionData } from "react-router";

export function meta(_: Route.MetaArgs) {
  return [{ title: "New post · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

const schema = z.object({
  title: z.string().min(2, "Give the story a title").max(200),
  slug: z.string().max(120).optional(),
  excerpt: z.string().max(500).optional(),
  bodyHtml: z.string().max(200_000).optional(),
  bodyJson: z.string().max(400_000).optional(),
  status: z.enum(["draft", "published"]),
  heroMediaId: z.string().max(64).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  const form = await request.formData();
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

  const title = parsed.data.title.trim();
  let slug = (parsed.data.slug ?? slugify(title)) || slugify(title);
  const existing = await db
    .select({ slug: posts.slug })
    .from(posts);
  slug = uniqueSlug(
    slug,
    existing.map((p) => p.slug),
  );

  let bodyJson: unknown = null;
  if (parsed.data.bodyJson) {
    try {
      bodyJson = JSON.parse(parsed.data.bodyJson);
    } catch {
      // ignore — empty/invalid JSON just gets stored as null
    }
  }

  const status = parsed.data.status;
  const [inserted] = await db
    .insert(posts)
    .values({
      title,
      slug,
      excerpt: parsed.data.excerpt ?? null,
      bodyHtml: parsed.data.bodyHtml ?? "",
      bodyJson,
      status,
      heroMediaId: parsed.data.heroMediaId || null,
      authorId: user.id,
      publishedAt: status === "published" ? new Date() : null,
    })
    .returning({ id: posts.id });

  throw redirect(`/admin/posts/${inserted.id}/edit?saved=1`);
}

export default function AdminPostsNew() {
  const data = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Content" title="New post">
      <AdminBreadcrumbs
        items={[
          { label: "News & posts", to: "/admin/posts" },
          { label: "New post" },
        ]}
      />
      <PostForm errors={data?.errors} submitLabel="Save post" />
    </AdminPage>
  );
}
