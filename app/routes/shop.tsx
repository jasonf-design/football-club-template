import { eq } from "drizzle-orm";
import type { Route } from "./+types/shop";
import { db } from "~/db.server";
import { products } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Shop · Doncaster City FC" },
    {
      name: "description",
      content: "Official Doncaster City FC merchandise.",
    },
  ];
}

export async function loader() {
  const all = await db
    .select()
    .from(products)
    .where(eq(products.active, true))
    .orderBy(products.sortOrder);
  return { products: all };
}

export default function Shop({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Club shop"
        title="Wear the badge."
        lede="Shirts, scarves, and the little things that make matchday matchday. Every purchase goes straight back into the club."
      />
      <Container size="wide" className="py-16">
        {products.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              The shop is closed for kit drop.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              First-season merchandise lands soon. Get on the list for when it
              does.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8">
            {products.map((p) => (
              <article key={p.id} className="group">
                <div className="aspect-square bg-navy/5 relative overflow-hidden" />
                <h3 className="font-serif text-lg text-navy mt-4 leading-tight">
                  {p.name}
                </h3>
                <div className="text-sm text-mute mt-1">
                  £{(p.pricePence / 100).toFixed(2)}
                </div>
              </article>
            ))}
          </div>
        )}
      </Container>
    </>
  );
}
