import type { Route } from "./+types/terms";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Terms & Conditions · Doncaster City FC" },
    { name: "description", content: "Terms and conditions for using the Doncaster City FC website and services." },
  ];
}

export default function Terms() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Terms & Conditions"
        lede="Please read these terms carefully before using our website or making a purchase."
      />
      <Container size="default" className="py-16">
        <div className="prose prose-sm max-w-2xl text-ink">
          <p className="text-mute text-sm">Last updated: June 2026</p>

          <Section title="About us">
            <p>
              This website is operated by <strong>Doncaster City Football Club Ltd</strong> (company number 14179792),
              referred to below as "we", "us", or "the club". By using this website you agree to these terms.
            </p>
          </Section>

          <Section title="Use of this website">
            <p>
              You may use this website for lawful purposes only. You must not use it in any way that breaches
              applicable law, infringes our intellectual property rights, or interferes with others' use of the site.
            </p>
            <p>
              We reserve the right to suspend or withdraw access to the website at any time without notice.
            </p>
          </Section>

          <Section title="Shop orders">
            <p>
              When you place an order through the club shop, you are making an offer to purchase goods. We will
              confirm your order by email. A contract is formed when we dispatch your order.
            </p>
            <ul>
              <li>
                <strong>Payment</strong> — all prices are in pounds sterling and include VAT where applicable.
                Payment is taken at the time of order via Stripe.
              </li>
              <li>
                <strong>Delivery</strong> — estimated delivery times are shown at checkout. We are not responsible
                for delays caused by postal services or circumstances outside our control.
              </li>
              <li>
                <strong>Returns</strong> — if your item arrives damaged or incorrect, please contact us within 14
                days via the <a href="/contact" className="text-sky-deep hover:underline">contact page</a> and we
                will arrange a replacement or refund. Personalised or made-to-order items cannot be returned unless
                faulty.
              </li>
              <li>
                <strong>Consumer rights</strong> — nothing in these terms affects your statutory rights under the
                Consumer Rights Act 2015 or other applicable consumer legislation.
              </li>
            </ul>
          </Section>

          <Section title="Player & pitch sponsorship">
            <p>
              Sponsoring a player or a virtual pitch square is a one-off payment for the current season. It does
              not confer any ownership rights, equity, or ongoing entitlement. Sponsorships are non-refundable
              once the payment has been processed and your name has been published on the website.
            </p>
            <p>
              We reserve the right to remove any sponsor name or logo that we consider inappropriate or contrary
              to the club's values.
            </p>
          </Section>

          <Section title="Club donations">
            <p>
              Donations made via the Support page are voluntary contributions to Doncaster City Football Club Ltd.
              They are not charitable donations and are not eligible for Gift Aid. Donations are non-refundable.
            </p>
          </Section>

          <Section title="Intellectual property">
            <p>
              All content on this website — including the Doncaster City FC crest, branding, text, photographs,
              and graphics — is owned by or licensed to Doncaster City Football Club Ltd. You may not reproduce,
              distribute, or use any content for commercial purposes without our written permission.
            </p>
          </Section>

          <Section title="Links to other websites">
            <p>
              Our website contains links to third-party sites (including Stripe, Easyfundraising, and social media
              platforms). We are not responsible for the content or privacy practices of those sites and encourage
              you to read their terms and privacy policies.
            </p>
          </Section>

          <Section title="Limitation of liability">
            <p>
              We provide this website on an "as is" basis. To the fullest extent permitted by law, we exclude all
              liability for any loss or damage arising from your use of the website or its content, including but
              not limited to loss of data, loss of revenue, or indirect or consequential loss.
            </p>
            <p>
              Our total liability to you for any claim arising out of a purchase shall not exceed the amount you
              paid for that purchase.
            </p>
          </Section>

          <Section title="Governing law">
            <p>
              These terms are governed by the laws of England and Wales. Any disputes will be subject to the
              exclusive jurisdiction of the courts of England and Wales.
            </p>
          </Section>

          <Section title="Changes to these terms">
            <p>
              We may update these terms from time to time. The date at the top of this page shows when they were
              last revised. Continued use of the website after changes are posted constitutes acceptance of the
              updated terms.
            </p>
          </Section>

          <Section title="Contact">
            <p>
              For any questions about these terms, please use our{" "}
              <a href="/contact" className="text-sky-deep hover:underline">contact page</a>.
            </p>
          </Section>
        </div>
      </Container>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-10 first:mt-0">
      <h2 className="font-serif text-2xl text-navy mb-4">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">{children}</div>
    </div>
  );
}
