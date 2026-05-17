import { asc, eq } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/shop";
import { db } from "~/db.server";
import { media, products } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import {
  fallbackFormatFor,
  variantSrcset,
  variantUrl,
} from "~/lib/uploads";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Shop · Doncaster City FC" },
    {
      name: "description",
      content:
        "Official Doncaster City FC merchandise. Every purchase goes back into the club.",
    },
  ];
}

export async function loader() {
  const rows = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      pricePence: products.pricePence,
      stock: products.stock,
      imageFilename: media.filename,
    })
    .from(products)
    .leftJoin(media, eq(media.id, products.imageMediaId))
    .where(eq(products.active, true))
    .orderBy(asc(products.sortOrder), asc(products.name));
  return { products: rows };
}

export default function Shop({ loaderData }: Route.ComponentProps) {
  const { products } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Club shop"
        title="Wear the badge."
        lede="Shirts, scarves and the little things that make matchday matchday. Every purchase goes straight back into the club."
      />
      <Container size="wide" className="py-16">
        {products.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              Closed for kit drop.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              First-season merch lands here soon. Get in touch if you'd like
              an early heads-up.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-10">
            {products.map((p) => {
              const filename = p.imageFilename;
              const fallback = filename ? fallbackFormatFor(filename) : null;
              const soldOut = p.stock === 0;
              const sizes =
                "(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 48vw";
              return (
                <Link
                  key={p.id}
                  to={`/shop/${p.slug}`}
                  className="group block"
                >
                  <div className="aspect-square bg-paper-warm relative overflow-hidden">
                    {filename && fallback ? (
                      <picture>
                        <source
                          type="image/avif"
                          srcSet={variantSrcset(filename, "avif") ?? undefined}
                          sizes={sizes}
                        />
                        <img
                          src={variantUrl(filename, 600, fallback)}
                          srcSet={variantSrcset(filename, fallback) ?? undefined}
                          sizes={sizes}
                          alt={p.name}
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                        />
                      </picture>
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/10" />
                    )}
                    {soldOut && (
                      <div className="absolute top-3 left-3 bg-paper text-navy text-[10px] tracking-[0.18em] uppercase px-2 py-0.5">
                        Sold out
                      </div>
                    )}
                  </div>
                  <div className="pt-4 flex items-baseline justify-between gap-3">
                    <h3 className="font-serif text-lg text-navy leading-tight group-hover:text-sky-bright transition-colors">
                      {p.name}
                    </h3>
                    <div className="text-sm text-ink font-medium whitespace-nowrap">
                      £{(p.pricePence / 100).toFixed(2)}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </Container>
    </>
  );
}
