import { Form, Link, useNavigation } from "react-router";
import { ClientOnly } from "~/components/ClientOnly";
import { PostEditor } from "./PostEditor";
import { ImagePicker } from "./ImagePicker";
import { Field, FormRow, TextArea, TextInput } from "./Field";
import { PrimaryButton, SecondaryButton } from "./AdminShell";

export type PostFormData = {
  id?: string;
  slug?: string;
  title?: string;
  excerpt?: string | null;
  bodyHtml?: string;
  bodyJson?: unknown;
  status?: "draft" | "published";
  heroMediaId?: string | null;
  heroUrl?: string | null;
};

export function PostForm({
  initial = {},
  errors = {},
  submitLabel = "Save changes",
}: {
  initial?: PostFormData;
  errors?: Record<string, string>;
  submitLabel?: string;
}) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";

  return (
    <Form method="post" className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
      <div className="space-y-5 min-w-0">
        <Field name="title" label="Title" error={errors.title} required>
          <TextInput
            name="title"
            defaultValue={initial.title}
            placeholder="A new chapter begins…"
            required
            className="text-2xl font-serif !py-3.5"
          />
        </Field>

        <Field
          name="slug"
          label="URL slug"
          error={errors.slug}
          hint="Leave blank to auto-generate from the title"
        >
          <TextInput
            name="slug"
            defaultValue={initial.slug}
            placeholder="a-new-chapter-begins"
          />
        </Field>

        <Field
          name="excerpt"
          label="Excerpt"
          hint="Shown on the news list and in social previews"
          error={errors.excerpt}
        >
          <TextArea
            name="excerpt"
            defaultValue={initial.excerpt ?? ""}
            rows={3}
            placeholder="One or two sentences that pull people in."
          />
        </Field>

        <div>
          <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-1.5">
            Story
          </div>
          <ClientOnly
            fallback={
              <div className="bg-paper border border-line min-h-[400px] grid place-items-center text-mute text-sm">
                Loading editor…
              </div>
            }
          >
            {() => (
              <PostEditor
                initialHtml={initial.bodyHtml}
                initialJson={initial.bodyJson}
              />
            )}
          </ClientOnly>
          {errors.bodyHtml && (
            <div className="mt-1.5 text-xs text-red">{errors.bodyHtml}</div>
          )}
        </div>
      </div>

      <aside className="space-y-6">
        <div className="bg-paper border border-line p-5">
          <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-3">
            Publish
          </div>
          <FormRow cols={1}>
            <Field name="status" label="Status">
              <select
                name="status"
                defaultValue={initial.status ?? "draft"}
                className="w-full bg-paper border border-line focus:border-navy outline-none px-3.5 py-2.5 text-sm text-ink"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </Field>
          </FormRow>
          <div className="mt-5 flex flex-col gap-2">
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Saving…" : submitLabel}
            </PrimaryButton>
            <Link
              to="/admin/posts"
              className="text-center text-xs uppercase tracking-[0.18em] text-mute hover:text-navy py-1"
            >
              Cancel
            </Link>
          </div>
        </div>

        <div className="bg-paper border border-line p-5">
          <ImagePicker
            name="heroMediaId"
            label="Hero image"
            initialUrl={initial.heroUrl}
            initialMediaId={initial.heroMediaId}
            aspect="aspect-[16/10]"
          />
        </div>
      </aside>
    </Form>
  );
}
