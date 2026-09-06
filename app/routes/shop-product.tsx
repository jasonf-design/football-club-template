import { and, eq } from "drizzle-orm";
import { data, Link } from "react-router";
import type { Route } from "./+types/shop-product";
import { db } from "~/db.server";
import { media, products } from "../../db/schema";
import { Container } from "~/components/Container";
import { AddToCart } from "~/components/AddToCart";
import { uploadUrlFor } from "~/lib/uploads";
import { club } from "~/club.config";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.product) return [{ title: `Product not found · ${club.name.short}` }];
  return [
    { title: `${data.product.name} · ${club.name.short}` },
    {
      name: "description",
      content: data.product.description ?? undefined,
    },
  ];
}

export async function loader({ params }: Route.LoaderArgs) {
  const [product] = await db
    .select({
      id: products.id,
      slug: products.slug,
      name: products.name,
      description: products.description,
      pricePence: products.pricePence,
      stock: products.stock,
      imageFilename: media.filename,
    })
    .from(products)
    .leftJoin(media, eq(media.id, products.imageMediaId))
    .where(and(eq(products.slug, params.slug), eq(products.active, true)))
    .limit(1);
  if (!product) throw data("Not Found", { status: 404 });
  return { product };
}

export default function ShopProduct({ loaderData }: Route.ComponentProps) {
  const { product } = loaderData;
  const img = uploadUrlFor(product.imageFilename);
  const soldOut = product.stock === 0;
  return (
    <article>
      <Container size="wide" className="py-12 md:py-20">
        <div className="text-xs uppercase tracking-[0.22em] text-mute mb-8">
          <Link to="/shop" className="hover:text-navy">
            Shop
          </Link>{" "}
          / {product.name}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20">
          <div className="aspect-square bg-paper-warm relative overflow-hidden">
            {img ? (
              <img
                src={img}
                alt={product.name}
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-navy via-navy-deep to-sky/10" />
            )}
          </div>
          <div className="lg:pt-6">
            <h1 className="font-serif text-4xl md:text-5xl text-navy leading-tight tracking-tight">
              {product.name}
            </h1>
            <div className="scoreboard text-3xl text-navy mt-6">
              £{(product.pricePence / 100).toFixed(2)}
            </div>
            {product.description && (
              <p className="mt-8 text-mute text-base leading-relaxed whitespace-pre-wrap">
                {product.description}
              </p>
            )}
            <div className="mt-10">
              <AddToCart productId={product.id} soldOut={soldOut} />
              {!soldOut && product.stock != null && product.stock <= 5 && (
                <div className="mt-3 text-xs uppercase tracking-[0.18em] text-red">
                  Only {product.stock} left
                </div>
              )}
            </div>
            <ul className="mt-12 text-xs text-mute space-y-2 border-t border-line pt-6">
              <li className="flex justify-between">
                <span>Delivery</span>
                <span className="text-ink">UK Royal Mail, 3–5 working days</span>
              </li>
              <li className="flex justify-between">
                <span>Returns</span>
                <span className="text-ink">14 days, unworn</span>
              </li>
              <li className="flex justify-between">
                <span>Supporting</span>
                <span className="text-ink">Doncaster City FC directly</span>
              </li>
            </ul>
          </div>
        </div>
      </Container>
    </article>
  );
}
