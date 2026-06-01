import type { Route } from "./+types/privacy";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Privacy Policy · Doncaster City FC" },
    { name: "description", content: "How Doncaster City FC collects, uses, and protects your personal information." },
  ];
}

export default function Privacy() {
  return (
    <>
      <PageHeader
        eyebrow="Legal"
        title="Privacy Policy"
        lede="How we collect, use, and protect your personal information."
      />
      <Container size="default" className="py-16">
        <div className="prose prose-sm max-w-2xl text-ink">
          <p className="text-mute text-sm">Last updated: June 2026</p>

          <Section title="Who we are">
            <p>
              This website is operated by <strong>Doncaster City Football Club Ltd</strong> (company number 14179792),
              referred to in this policy as "we", "us", or "the club". We are the data controller for personal
              information collected through this website.
            </p>
            <p>
              You can contact us about data matters via our <a href="/contact" className="text-sky-deep hover:underline">contact page</a>.
            </p>
          </Section>

          <Section title="What information we collect">
            <p>We collect personal information in the following circumstances:</p>
            <ul>
              <li>
                <strong>Contact form</strong> — your name, email address, and the contents of your message when you
                submit an enquiry through our contact page.
              </li>
              <li>
                <strong>Payments</strong> — when you make a purchase (club shop, pitch sponsorship, player sponsorship,
                or a club donation), your payment is processed securely by <strong>Stripe</strong>. We do not store
                your card details. We receive your email address and the name you provide at checkout, along with a
                record of the transaction.
              </li>
              <li>
                <strong>Shop orders</strong> — your name, email address, and delivery address when placing an order
                through the club shop.
              </li>
              <li>
                <strong>Sponsor details</strong> — your name and business name if you choose to sponsor a player or
                a virtual pitch square.
              </li>
            </ul>
            <p>We do not use cookies for advertising or tracking, and we do not use third-party analytics services.</p>
          </Section>

          <Section title="How we use your information">
            <p>We use the information we collect to:</p>
            <ul>
              <li>Respond to your enquiries and messages</li>
              <li>Process and fulfil your orders and sponsorship arrangements</li>
              <li>Display your sponsor name on the website where you have agreed to this</li>
              <li>Send you transactional emails related to your order or enquiry</li>
              <li>Comply with our legal obligations</li>
            </ul>
            <p>
              We will not use your personal information for marketing without your explicit consent, and we will
              never sell your data to third parties.
            </p>
          </Section>

          <Section title="Legal basis for processing">
            <p>We process your personal information on the following legal bases under UK GDPR:</p>
            <ul>
              <li>
                <strong>Contract</strong> — processing necessary to fulfil an order or sponsorship arrangement you
                have entered into with us.
              </li>
              <li>
                <strong>Legitimate interests</strong> — responding to contact form messages and enquiries.
              </li>
              <li>
                <strong>Legal obligation</strong> — retaining transaction records as required by law.
              </li>
            </ul>
          </Section>

          <Section title="How long we keep your information">
            <p>
              We retain contact form messages for up to 12 months. Order and payment records are kept for 7 years
              in line with HMRC requirements. We will delete your data sooner if you ask us to and there is no
              legal reason to retain it.
            </p>
          </Section>

          <Section title="Third parties">
            <p>We share your information only where necessary:</p>
            <ul>
              <li>
                <strong>Stripe</strong> — payment processing. Stripe is PCI-DSS compliant. See{" "}
                <a href="https://stripe.com/gb/privacy" target="_blank" rel="noreferrer" className="text-sky-deep hover:underline">
                  Stripe's privacy policy
                </a>.
              </li>
              <li>
                <strong>Resend</strong> — transactional email delivery (contact form notifications).
              </li>
            </ul>
            <p>We do not share your personal data with any other third parties.</p>
          </Section>

          <Section title="Your rights">
            <p>Under UK data protection law you have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you</li>
              <li>Ask us to correct inaccurate data</li>
              <li>Ask us to delete your data (where no legal obligation requires us to keep it)</li>
              <li>Object to or restrict certain processing</li>
              <li>Receive your data in a portable format</li>
              <li>Withdraw consent at any time (where processing is based on consent)</li>
            </ul>
            <p>
              To exercise any of these rights, please contact us via our{" "}
              <a href="/contact" className="text-sky-deep hover:underline">contact page</a>. We will respond within
              one month.
            </p>
            <p>
              If you are unhappy with how we handle your data, you have the right to lodge a complaint with the
              Information Commissioner's Office (ICO) at{" "}
              <a href="https://ico.org.uk" target="_blank" rel="noreferrer" className="text-sky-deep hover:underline">
                ico.org.uk
              </a>.
            </p>
          </Section>

          <Section title="Cookies">
            <p>
              This website uses a session cookie solely to keep administrators logged in to the club management
              system. This cookie is strictly necessary for that functionality and is not used for tracking or
              advertising. No third-party cookies are set.
            </p>
          </Section>

          <Section title="Changes to this policy">
            <p>
              We may update this privacy policy from time to time. The date at the top of this page shows when it
              was last revised. Continued use of the website after any changes constitutes acceptance of the
              updated policy.
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
