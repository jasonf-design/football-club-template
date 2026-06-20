import { asc, eq } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/shop";
import { db } from "~/db.server";
import { media, products } from "../../db/schema";
import { Container } from "~/components/Container";
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
      {/* Macron banner — image speaks for itself, no text overlay */}
      <a
        href="https://www.macronstorewakefield.co.uk/store/Doncaster-City-c201709522"
        target="_blank"
        rel="noopener noreferrer"
        className="group block w-full"
        aria-label="Shop Doncaster City kits and training wear on the official Macron store"
      >
        <img
          src="/macron-banner.png"
          alt="Macron Sports Hub Wakefield — Official Kit Supplier"
          width={2400}
          height={600}
          className="w-full h-auto block"
        />
        <div className="bg-navy flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 sm:px-10 py-5">
          <p className="text-paper font-serif text-xl">
            Shop kits &amp; training wear at the official Macron store
          </p>
          <div className="shrink-0 flex items-center gap-2.5 bg-sky group-hover:bg-sky-bright transition-colors duration-200 text-navy font-semibold text-sm tracking-wide px-7 py-3.5 whitespace-nowrap">
            Shop at Macron
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 8h10M9 4l4 4-4 4" />
            </svg>
          </div>
        </div>
      </a>

      <Container size="wide" className="py-16">
        <h2 className="font-serif text-3xl text-navy mb-10">Club merchandise</h2>
        {products.length === 0 ? (
          <div className="border border-line bg-paper-warm/40 p-16 text-center">
            <div className="font-serif text-3xl text-navy">
              More merch coming soon.
            </div>
            <p className="mt-3 text-mute max-w-md mx-auto">
              Scarves, badges and more land here shortly. In the meantime, grab your kit from the Macron store above.
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
