import { eq } from "drizzle-orm";
import { Form, Link, redirect, useActionData } from "react-router";
import type { Route } from "./+types/sponsor-player";
import { db } from "~/db.server";
import { players } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { getStripe, isStripeConfigured, publicUrl } from "~/lib/stripe.server";
import { sendPlayerSponsorInterestNotification } from "~/lib/email.server";
import { club } from "~/club.config";

const SPONSORSHIP_PRICE_PENCE = 20000; // £200

export function meta(_: Route.MetaArgs) {
  return [{ title: `Sponsor a player · ${club.name.short}` }];
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
            description: ` · Player sponsorship for the season`,
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

export async function action({ request, params }: Route.ActionArgs) {
  const [player] = await db
    .select({ id: players.id, name: players.name, active: players.active })
    .from(players)
    .where(eq(players.id, params.id))
    .limit(1);

  if (!player || !player.active) throw redirect("/team");

  const formData = await request.formData();
  const sponsorName = String(formData.get("name") ?? "").trim();
  const sponsorEmail = String(formData.get("email") ?? "").trim();

  if (!sponsorName || !sponsorEmail) {
    return { ok: false as const, error: "Please fill in your name and email." };
  }

  await sendPlayerSponsorInterestNotification({
    sponsorName,
    sponsorEmail,
    playerName: player.name,
    pricePence: SPONSORSHIP_PRICE_PENCE,
  });

  return { ok: true as const };
}

// Only rendered when Stripe is not yet configured.
export default function SponsorPlayer({ loaderData }: Route.ComponentProps) {
  const { player } = loaderData;
  const result = useActionData<typeof action>();

  return (
    <>
      <PageHeader
        eyebrow="Player sponsorship"
        title={`Sponsor ${player.name}`}
        lede={`Support ${player.name} for the season — £${(SPONSORSHIP_PRICE_PENCE / 100).toFixed(0)}. Leave your details and we'll be in touch to arrange payment.`}
      />
      <Container size="wide" className="py-12 max-w-md">
        {result?.ok ? (
          <div className="border-l-4 border-green bg-paper-warm p-8">
            <div className="font-serif text-2xl text-navy">Thanks — we'll be in touch.</div>
            <p className="mt-2 text-mute">
              We've noted your interest in sponsoring {player.name}. Someone from the
              club will contact you to arrange payment.
            </p>
          </div>
        ) : (
          <Form method="post" className="space-y-6">
            <Field name="name" label="Your name" required />
            <Field name="email" label="Email" type="email" required />
            {"error" in (result ?? {}) && (result as { error: string }).error && (
              <p className="text-sm text-red">{(result as { error: string }).error}</p>
            )}
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-navy text-paper px-7 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
            >
              Register interest
            </button>
            <p className="text-xs text-mute">
              Or{" "}
              <Link to="/contact" className="underline hover:text-navy">
                contact us
              </Link>{" "}
              directly.
            </p>
          </Form>
        )}
      </Container>
    </>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.24em] text-mute mb-2">
        {label}
        {required && <span className="text-red ml-1">*</span>}
      </span>
      <input
        type={type}
        name={name}
        required={required}
        className="w-full bg-paper border border-line focus:border-navy focus:ring-0 outline-none px-4 py-3 text-base text-ink transition-colors"
      />
    </label>
  );
}
