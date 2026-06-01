import { eq } from "drizzle-orm";
import { Link, redirect } from "react-router";
import type { Route } from "./+types/sponsor-player";
import { db } from "~/db.server";
import { players } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { getStripe, isStripeConfigured, publicUrl } from "~/lib/stripe.server";

const SPONSORSHIP_PRICE_PENCE = 20000; // £200

export function meta(_: Route.MetaArgs) {
  return [{ title: "Sponsor a player · Doncaster City FC" }];
}

export async function loader({ params }: Route.LoaderArgs) {
  const [player] = await db
    .select({ id: players.id, name: players.name, active: players.active })
    .from(players)
    .where(eq(players.id, params.id))
    .limit(1);

  if (!player || !player.active) throw redirect("/team");

  if (!isStripeConfigured()) {
    return { player };
  }

  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "gbp",
          unit_amount: SPONSORSHIP_PRICE_PENCE,
          product_data: {
            name: `Sponsor ${player.name}`,
            description: "Doncaster City FC · Player sponsorship for the season",
          },
        },
      },
    ],
    metadata: {
      kind: "player_sponsor",
      playerId: player.id,
      playerName: player.name,
    },
    success_url: `${publicUrl()}/sponsor/success?session_id={CHECKOUT_SESSION_ID}&player=${encodeURIComponent(player.name)}`,
    cancel_url: `${publicUrl()}/team`,
  });

  throw redirect(session.url!);
}

// Only rendered when Stripe is not yet configured.
export default function SponsorPlayer({ loaderData }: Route.ComponentProps) {
  const { player } = loaderData;
  return (
    <>
      <PageHeader
        eyebrow="Player sponsorship"
        title={`Sponsor ${player.name}`}
        lede="Online payments are being set up — check back soon, or get in touch via the contact page to arrange a sponsorship manually."
      />
      <Container size="wide" className="py-12 text-center">
        <Link
          to="/contact"
          className="inline-flex items-center gap-2 bg-navy text-paper px-6 py-3 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
        >
          Contact us
        </Link>
      </Container>
    </>
  );
}
