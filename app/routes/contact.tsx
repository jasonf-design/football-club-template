import { useActionData, Form } from "react-router";
import type { Route } from "./+types/contact";
import { z } from "zod";
import { db } from "~/db.server";
import { contactMessages } from "../../db/schema";
import { Container } from "~/components/Container";
import { PageHeader } from "~/components/PageHeader";
import { sendContactNotification } from "~/lib/email.server";
import { club } from "~/club.config";

export function meta(_: Route.MetaArgs) {
  return [
    { title: `Contact · ${club.name.short}` },
    {
      name: "description",
      content: "Get in touch with Doncaster City Football Club.",
    },
  ];
}

const schema = z.object({
  name: z.string().min(2, "Please share your name").max(120),
  email: z.string().email("That doesn't look like a valid email"),
  subject: z.string().max(200).optional(),
  message: z.string().min(10, "Tell us a bit more").max(5000),
  // honeypot — bots fill this; humans don't see it
  website: z.string().max(0).optional(),
});

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    subject: formData.get("subject") || undefined,
    message: formData.get("message"),
    website: formData.get("website") || undefined,
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path[0] as string] = issue.message;
    }
    return { ok: false as const, errors };
  }
  // honeypot tripped — silently succeed without storing
  if (parsed.data.website) return { ok: true as const };

  await db.insert(contactMessages).values({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject,
    message: parsed.data.message,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await sendContactNotification({
    name: parsed.data.name,
    email: parsed.data.email,
    subject: parsed.data.subject ?? null,
    message: parsed.data.message,
  });

  return { ok: true as const };
}

export default function Contact() {
  const result = useActionData<typeof action>();
  return (
    <>
      <PageHeader
        eyebrow="Say hello"
        title="Get in touch."
        lede="Match enquiries, partnership ideas, or just want to say hello? Drop us a line and someone from the club will come back to you."
      />
      <Container size="wide" className="py-16 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-16">
        <aside className="space-y-10">
          <ContactBlock title="General enquiries">
            <p>
              Use the form to reach the club for anything &mdash; match
              enquiries, supporter questions, media requests.
            </p>
          </ContactBlock>
          <ContactBlock title="Partnerships">
            <p>
              Interested in sponsoring the club? Drop us a line via the form
              and mention &ldquo;partnerships&rdquo; in the subject.
            </p>
          </ContactBlock>
          <ContactBlock title="Matchday">
            <p>
              Address &amp; directions to be announced before the season opener.
            </p>
          </ContactBlock>
        </aside>

        <div>
          {result?.ok ? (
            <div className="border-l-4 border-green bg-paper-warm p-8">
              <div className="font-serif text-2xl text-navy">
                Thanks for reaching out.
              </div>
              <p className="mt-2 text-mute">
                Someone from the club will come back to you within a couple of
                working days.
              </p>
            </div>
          ) : (
            <Form method="post" className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <Field
                  name="name"
                  label="Your name"
                  error={result?.errors?.name}
                  required
                />
                <Field
                  name="email"
                  label="Email"
                  type="email"
                  error={result?.errors?.email}
                  required
                />
              </div>
              <Field
                name="subject"
                label="Subject"
                error={result?.errors?.subject}
              />
              <Field
                name="message"
                label="Message"
                as="textarea"
                rows={6}
                error={result?.errors?.message}
                required
              />
              {/* honeypot */}
              <div className="hidden" aria-hidden>
                <label>
                  Website
                  <input type="text" name="website" tabIndex={-1} />
                </label>
              </div>
              <button
                type="submit"
                className="inline-flex items-center gap-2 bg-navy text-paper px-7 py-3.5 text-sm font-semibold tracking-wide uppercase hover:bg-navy-deep transition-colors"
              >
                Send message
              </button>
            </Form>
          )}
        </div>
      </Container>
    </>
  );
}

function ContactBlock({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">
        {title}
      </div>
      <div className="text-base text-ink">{children}</div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  as = "input",
  rows,
  error,
  required,
}: {
  name: string;
  label: string;
  type?: string;
  as?: "input" | "textarea";
  rows?: number;
  error?: string;
  required?: boolean;
}) {
  const cls =
    "w-full bg-paper border border-line focus:border-navy focus:ring-0 outline-none px-4 py-3 text-base text-ink transition-colors";
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-[0.24em] text-mute mb-2">
        {label}
        {required && <span className="text-red ml-1">*</span>}
      </span>
      {as === "textarea" ? (
        <textarea name={name} rows={rows ?? 4} className={cls} required={required} />
      ) : (
        <input type={type} name={name} className={cls} required={required} />
      )}
      {error && <span className="block mt-1.5 text-xs text-red">{error}</span>}
    </label>
  );
}
