import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-shop-new";
import { db } from "~/db.server";
import { products } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { slugify, uniqueSlug } from "~/lib/slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { ProductForm } from "~/components/admin/ProductForm";

export function meta(_: Route.MetaArgs) {
  return [{ title: "New product · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  return null;
}

const schema = z.object({
  name: z.string().min(2).max(160),
  slug: z.string().max(120).optional(),
  description: z.string().max(5000).optional(),
  pricePence: z.coerce.number().int().min(0).max(10_000_000),
  stock: z.string().optional(),
  imageMediaId: z.string().max(64).optional(),
  sortOrder: z.string().optional(),
  active: z.string().optional(),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const parsed = schema.safeParse({
    name: form.get("name"),
    slug: form.get("slug") || undefined,
    description: form.get("description") || undefined,
    pricePence: form.get("pricePence"),
    stock: form.get("stock") || undefined,
    imageMediaId: form.get("imageMediaId") || undefined,
    sortOrder: form.get("sortOrder") || undefined,
    active: form.get("active") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { errors };
  }
  const name = parsed.data.name.trim();
  let slug = (parsed.data.slug ?? slugify(name)) || slugify(name);
  const existing = await db.select({ slug: products.slug }).from(products);
  slug = uniqueSlug(
    slug,
    existing.map((p) => p.slug),
  );
  const stock = parsed.data.stock ? Number(parsed.data.stock) : null;
  const sortOrder = parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0;
  await db.insert(products).values({
    name,
    slug,
    description: parsed.data.description ?? null,
    pricePence: parsed.data.pricePence,
    stock: Number.isFinite(stock) ? stock : null,
    imageMediaId: parsed.data.imageMediaId || null,
    sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
    active: parsed.data.active === "on",
  });
  throw redirect("/admin/shop");
}

export default function AdminShopNew() {
  const data = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Shop" title="New product">
      <AdminBreadcrumbs
        items={[{ label: "Products", to: "/admin/shop" }, { label: "New" }]}
      />
      <ProductForm errors={data?.errors} submitLabel="Add product" />
    </AdminPage>
  );
}
