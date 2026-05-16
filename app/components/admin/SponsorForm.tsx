import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, Select, TextInput } from "./Field";
import { ImagePicker } from "./ImagePicker";
import { PrimaryButton } from "./AdminShell";

export type SponsorFormData = {
  name?: string;
  url?: string | null;
  tier?: "principal" | "official" | "partner";
  logoMediaId?: string | null;
  logoUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export function SponsorForm({
  initial = {},
  errors = {},
  submitLabel = "Save sponsor",
}: {
  initial?: SponsorFormData;
  errors?: Record<string, string>;
  submitLabel?: string;
}) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  return (
    <Form
      method="post"
      className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-5xl"
    >
      <div className="bg-paper border border-line p-6 lg:p-8 space-y-5">
        <Field name="name" label="Sponsor name" error={errors.name} required>
          <TextInput
            name="name"
            defaultValue={initial.name}
            placeholder="Acme Doncaster Ltd"
            required
          />
        </Field>
        <FormRow cols={2}>
          <Field name="tier" label="Tier" error={errors.tier}>
            <Select name="tier" defaultValue={initial.tier ?? "partner"}>
              <option value="principal">Principal Partner</option>
              <option value="official">Official Partner</option>
              <option value="partner">Club Partner</option>
            </Select>
          </Field>
          <Field name="url" label="Website" error={errors.url}>
            <TextInput
              name="url"
              type="url"
              defaultValue={initial.url ?? ""}
              placeholder="https://example.com"
            />
          </Field>
        </FormRow>
        <FormRow cols={2}>
          <Field name="sortOrder" label="Sort order" hint="Lower numbers first">
            <TextInput
              name="sortOrder"
              type="number"
              defaultValue={initial.sortOrder ?? 0}
            />
          </Field>
          <Field name="active" label="Active">
            <label className="flex items-center gap-2 mt-1 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={initial.active ?? true}
                className="h-4 w-4 accent-navy"
              />
              <span>Show on the public site</span>
            </label>
          </Field>
        </FormRow>
        <div className="flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </PrimaryButton>
          <Link
            to="/admin/sponsors"
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
          >
            Cancel
          </Link>
        </div>
      </div>
      <div className="bg-paper border border-line p-5">
        <ImagePicker
          name="logoMediaId"
          label="Logo"
          initialUrl={initial.logoUrl}
          initialMediaId={initial.logoMediaId}
          aspect="aspect-[3/2]"
        />
      </div>
    </Form>
  );
}
