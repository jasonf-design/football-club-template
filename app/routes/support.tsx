import { redirect, useActionData } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/support";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { getStripe, isStripeConfigured, publicUrl } from "~/lib/stripe.server";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Support the Danum Blues · Doncaster City FC" },
    {
      name: "description",
      content:
        "Support Doncaster City FC with a one-off contribution. Every pound goes directly towards kit, equipment, and growing the club.",
    },
  ];
}

const PRESET_AMOUNTS = [5, 10, 25, 50];

const donationSchema = z.object({
  amount: z.coerce
    .number({ invalid_type_error: "Please enter an amount." })
    .int("Please enter a whole number of pounds.")
    .min(1, "Minimum donation is £1.")
    .max(10000, "Please contact us for donations over £10,000."),
});

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const raw = form.get("amount");
  const parsed = donationSchema.safeParse({ amount: raw });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please enter a valid amount." };
  }

  const amountPence = parsed.data.amount * 100;

  if (!isStripeConfigured()) {
    return { error: "Online payments aren't set up yet — please get in touch via the contact page." };
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
          unit_amount: amountPence,
          product_data: {
            name: "Support Doncaster City FC",
            description: "Helping fund kit, equipment, and the growth of the Danum Blues.",
          },
        },
      },
    ],
    metadata: { kind: "club_donation", amountPence: String(amountPence) },
    success_url: `${publicUrl()}/support/success?amount=${parsed.data.amount}`,
    cancel_url: `${publicUrl()}/support`,
  });

  throw redirect(session.url!);
}

export default function Support(_: Route.ComponentProps) {
  const result = useActionData<typeof action>();

  return (
    <>
      <PageHeader
        eyebrow="Support the club"
        title="Support the Danum Blues."
        lede="Every pound goes directly towards kit, footballs, equipment, and helping Doncaster City FC grow. No amount is too small — it all adds up."
      />

      <Container size="wide" className="py-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">

          {/* Left: what it funds */}
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-6">Your money goes towards</div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "New Kits", icon: "👕" },
                { label: "Match balls", icon: "⚽" },
                { label: "New teams", icon: "🏆" },
                { label: "Training gear", icon: "🎽" },
              ].map((item) => (
                <div key={item.label} className="border border-line bg-paper-warm/30 px-6 py-8 text-center">
                  <div className="text-4xl mb-3">{item.icon}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-mute">{item.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: form */}
          <div>
            <form method="post" noValidate>
              <input type="hidden" name="amount" id="amount-hidden" />

              <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-4">
                Choose an amount
              </div>

              {/* Preset buttons */}
              <div className="grid grid-cols-4 gap-3 mb-3">
                {PRESET_AMOUNTS.map((amt) => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => selectAmount(amt)}
                    className="preset-btn border border-line bg-paper-warm/30 py-5 text-center font-serif text-2xl text-navy hover:border-navy hover:bg-navy/5 transition-colors focus:outline-none"
                    data-amount={amt}
                  >
                    £{amt}
                  </button>
                ))}
              </div>

              {/* Custom amount */}
              <div className="flex items-center border border-line bg-paper-warm/30 mb-6 focus-within:border-navy transition-colors">
                <span className="px-4 font-serif text-2xl text-mute select-none">£</span>
                <input
                  id="custom-amount"
                  type="number"
                  min="1"
                  placeholder="Other amount"
                  className="flex-1 bg-transparent py-5 pr-4 text-navy font-serif text-2xl placeholder:text-mute/40 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  onInput={(e) => selectCustom((e.target as HTMLInputElement).value)}
                />
              </div>

              {result?.error && (
                <div className="mb-4 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {result.error}
                </div>
              )}

              <button
                type="submit"
                className="w-full bg-navy text-paper py-5 font-semibold text-base tracking-wide uppercase hover:bg-navy-deep transition-colors"
              >
                Support the club →
              </button>

              <p className="mt-4 text-xs text-mute text-center leading-relaxed">
                Secure payment via Stripe. This is a voluntary contribution — no goods or services are provided in return.
              </p>
            </form>
          </div>

        </div>
      </Container>

      <script
        dangerouslySetInnerHTML={{
          __html: `
            var selectedPreset = null;
            function selectAmount(amt) {
              selectedPreset = amt;
              document.getElementById('amount-hidden').value = amt;
              document.getElementById('custom-amount').value = '';
              document.querySelectorAll('.preset-btn').forEach(function(b) {
                var active = parseInt(b.dataset.amount) === amt;
                b.classList.toggle('bg-navy', active);
                b.classList.toggle('text-paper', active);
                b.classList.toggle('border-navy', active);
                b.classList.toggle('bg-paper-warm/30', !active);
                b.classList.toggle('text-navy', !active);
              });
            }
            function selectCustom(val) {
              selectedPreset = null;
              document.getElementById('amount-hidden').value = val;
              document.querySelectorAll('.preset-btn').forEach(function(b) {
                b.classList.remove('bg-navy','text-paper','border-navy');
                b.classList.add('bg-paper-warm/30','text-navy');
              });
            }
            // Pre-select £10 on load
            selectAmount(10);
          `,
        }}
      />
    </>
  );
}
