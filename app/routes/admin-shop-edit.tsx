import { and, eq, ne } from "drizzle-orm";
import { data, redirect, useActionData, useLoaderData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-shop-edit";
import { db } from "~/db.server";
import { media, products } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { slugify, uniqueSlug } from "~/lib/slug";
import { AdminBreadcrumbs, AdminPage } from "~/components/admin/AdminShell";
import { ProductForm } from "~/components/admin/ProductForm";
import { uploadUrlFor } from "~/lib/uploads";

export function meta({ data }: Route.MetaArgs) {
  return [{ title: `Edit · ${data?.product.name ?? "product"} · Admin` }];
}

export async function loader({ request, params }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [product] = await db
    .select()
    .from(products)
    .where(eq(products.id, params.id))
    .limit(1);
  if (!product) throw data("Not Found", { status: 404 });
  let imageUrl: string | null = null;
  if (product.imageMediaId) {
    const [m] = await db
      .select({ filename: media.filename })
      .from(media)
      .where(eq(media.id, product.imageMediaId))
      .limit(1);
    imageUrl = uploadUrlFor(m?.filename);
  }
  return { product, imageUrl };
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

export async function action({ request, params }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await db.delete(products).where(eq(products.id, params.id));
    throw redirect("/admin/shop");
  }
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
  const [existing] = await db
    .select({ slug: products.slug })
    .from(products)
    .where(eq(products.id, params.id))
    .limit(1);
  if (!existing) throw data("Not Found", { status: 404 });
  const name = parsed.data.name.trim();
  let slug = (parsed.data.slug ?? slugify(name)) || slugify(name);
  if (slug !== existing.slug) {
    const taken = await db
      .select({ slug: products.slug })
      .from(products)
      .where(and(ne(products.id, params.id)));
    slug = uniqueSlug(
      slug,
      taken.map((p) => p.slug),
    );
  }
  const stock = parsed.data.stock ? Number(parsed.data.stock) : null;
  const sortOrder = parsed.data.sortOrder ? Number(parsed.data.sortOrder) : 0;
  await db
    .update(products)
    .set({
      name,
      slug,
      description: parsed.data.description ?? null,
      pricePence: parsed.data.pricePence,
      stock: Number.isFinite(stock) ? stock : null,
      imageMediaId: parsed.data.imageMediaId || null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      active: parsed.data.active === "on",
    })
    .where(eq(products.id, params.id));
  throw redirect("/admin/shop");
}

export default function AdminShopEdit() {
  const { product, imageUrl } = useLoaderData<typeof loader>();
  const result = useActionData<typeof action>();
  return (
    <AdminPage eyebrow="Shop" title={product.name}>
      <AdminBreadcrumbs
        items={[
          { label: "Products", to: "/admin/shop" },
          { label: product.name },
        ]}
      />
      <ProductForm
        initial={{
          name: product.name,
          slug: product.slug,
          description: product.description,
          pricePence: product.pricePence,
          stock: product.stock,
          imageMediaId: product.imageMediaId,
          imageUrl,
          active: product.active,
          sortOrder: product.sortOrder,
        }}
        errors={result?.errors}
        submitLabel="Save changes"
      />
    </AdminPage>
  );
}
