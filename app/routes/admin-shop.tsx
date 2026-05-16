import { asc, eq } from "drizzle-orm";
import { Form, Link } from "react-router";
import type { Route } from "./+types/admin-shop";
import { db } from "~/db.server";
import { media, products } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import {
  AdminPage,
  DangerButton,
  LinkButton,
  StatusPill,
  Table,
  Td,
  Th,
} from "~/components/admin/AdminShell";
import { uploadUrlFor } from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Shop · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      pricePence: products.pricePence,
      stock: products.stock,
      active: products.active,
      sortOrder: products.sortOrder,
      imageFilename: media.filename,
    })
    .from(products)
    .leftJoin(media, eq(media.id, products.imageMediaId))
    .orderBy(asc(products.sortOrder), asc(products.name));
  return { products: rows };
}

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const id = form.get("id");
  if (typeof id !== "string") return { ok: false };
  if (form.get("intent") === "delete") {
    await db.delete(products).where(eq(products.id, id));
  }
  return { ok: true };
}

export default function AdminShop({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;
  return (
    <AdminPage
      eyebrow="Shop"
      title="Products"
      description="Everything for sale on the public shop. Each variant (size, colour) is its own row for now."
      actions={<LinkButton to="/admin/shop/new">+ New product</LinkButton>}
    >
      {products.length === 0 ? (
        <div className="bg-paper border border-line p-12 text-center">
          <div className="font-serif text-2xl text-navy">No products yet.</div>
          <p className="mt-2 text-mute text-sm">
            Add the first one — shirts, scarves, anything you'd put on a
            matchday stall.
          </p>
          <div className="mt-5">
            <LinkButton to="/admin/shop/new">Add a product</LinkButton>
          </div>
        </div>
      ) : (
        <Table
          head={
            <>
              <Th className="w-full">Product</Th>
              <Th>Price</Th>
              <Th>Stock</Th>
              <Th>Status</Th>
              <Th className="text-right">Actions</Th>
            </>
          }
        >
          {products.map((p) => (
            <tr key={p.id} className="hover:bg-paper-warm/40">
              <Td>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 bg-line shrink-0 overflow-hidden">
                    {p.imageFilename && (
                      <img
                        src={uploadUrlFor(p.imageFilename) ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <div>
                    <Link
                      to={`/admin/shop/${p.id}/edit`}
                      className="font-medium text-navy hover:text-sky-bright"
                    >
                      {p.name}
                    </Link>
                    <div className="text-xs text-mute mt-0.5">/shop/{p.slug}</div>
                  </div>
                </div>
              </Td>
              <Td className="text-ink whitespace-nowrap">
                £{(p.pricePence / 100).toFixed(2)}
              </Td>
              <Td className="text-mute text-xs">
                {p.stock == null ? "∞" : p.stock}
              </Td>
              <Td>
                {p.active ? (
                  <StatusPill status="ok" label="Live" />
                ) : (
                  <StatusPill status="muted" label="Hidden" />
                )}
              </Td>
              <Td>
                <div className="flex justify-end gap-3 items-center">
                  {p.active && (
                    <Link
                      to={`/shop/${p.slug}`}
                      target="_blank"
                      className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
                    >
                      View ↗
                    </Link>
                  )}
                  <Link
                    to={`/admin/shop/${p.id}/edit`}
                    className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
                  >
                    Edit
                  </Link>
                  <Form method="post">
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={p.id} />
                    <DangerButton
                      type="submit"
                      onClick={(e) => {
                        if (!confirm(`Delete ${p.name}?`)) e.preventDefault();
                      }}
                    >
                      Delete
                    </DangerButton>
                  </Form>
                </div>
              </Td>
            </tr>
          ))}
        </Table>
      )}
    </AdminPage>
  );
}
