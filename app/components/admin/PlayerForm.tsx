import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, Select, TextArea, TextInput } from "./Field";
import { ImagePicker } from "./ImagePicker";
import { PrimaryButton } from "./AdminShell";

export type PlayerFormData = {
  name?: string;
  position?: string | null;
  position2?: string | null;
  bio?: string | null;
  photoMediaId?: string | null;
  photoUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
  sponsor1Name?: string | null;
  sponsor1Url?: string | null;
  sponsor1LogoMediaId?: string | null;
  sponsor1LogoUrl?: string | null;
  sponsor2Name?: string | null;
  sponsor2Url?: string | null;
  sponsor2LogoMediaId?: string | null;
  sponsor2LogoUrl?: string | null;
  sponsorshipUrl?: string | null;
};

const POSITIONS = [
  "Goalkeeper",
  "Defender",
  "Right back",
  "Centre back",
  "Left back",
  "Midfielder",
  "Defensive midfielder",
  "Attacking midfielder",
  "Winger",
  "Forward",
  "Striker",
];

export function PlayerForm({
  initial = {},
  errors = {},
  submitLabel = "Save player",
}: {
  initial?: PlayerFormData;
  errors?: Record<string, string>;
  submitLabel?: string;
}) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  return (
    <Form method="post" className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 max-w-5xl">
      <div className="space-y-6">
        {/* Core details */}
        <div className="bg-paper border border-line p-6 lg:p-8 space-y-5">
          <Field name="name" label="Name" error={errors.name} required>
            <TextInput
              name="name"
              defaultValue={initial.name}
              placeholder="Jamie Doncaster"
              required
              className="text-xl font-serif !py-3"
            />
          </Field>
          <FormRow cols={2}>
            <Field name="position" label="Primary position" error={errors.position}>
              <Select name="position" defaultValue={initial.position ?? ""}>
                <option value="">—</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </Field>
            <Field name="position2" label="Secondary position" error={errors.position2}>
              <Select name="position2" defaultValue={initial.position2 ?? ""}>
                <option value="">—</option>
                {POSITIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </Select>
            </Field>
          </FormRow>
          <Field name="bio" label="Bio" hint="A short paragraph" error={errors.bio}>
            <TextArea
              name="bio"
              defaultValue={initial.bio ?? ""}
              rows={5}
              placeholder="From the academy, signed in summer 2025…"
            />
          </Field>
          <FormRow cols={2}>
            <Field name="sortOrder" label="Sort order" hint="Lower numbers first">
              <TextInput name="sortOrder" type="number" defaultValue={initial.sortOrder ?? 0} />
            </Field>
            <Field name="active" label="Active">
              <label className="flex items-center gap-2 mt-1 text-sm">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={initial.active ?? true}
                  className="h-4 w-4 accent-navy"
                />
                <span>On the public squad page</span>
              </label>
            </Field>
          </FormRow>
          <div className="flex items-center gap-3 pt-2">
            <PrimaryButton type="submit" disabled={submitting}>
              {submitting ? "Saving…" : submitLabel}
            </PrimaryButton>
            <Link to="/admin/players" className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy">
              Cancel
            </Link>
          </div>
        </div>

        {/* Shirt sponsorship */}
        <div className="bg-paper border border-line p-6 lg:p-8 space-y-6">
          <div>
            <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-1">Player sponsorship</div>
            <p className="text-xs text-mute/70">Up to two sponsors per player. Leave blank to show "Available to sponsor".</p>
          </div>
          <SponsorSlot
            slot={1}
            initial={{ name: initial.sponsor1Name, url: initial.sponsor1Url, logoMediaId: initial.sponsor1LogoMediaId, logoUrl: initial.sponsor1LogoUrl }}
            errors={errors}
          />
          <div className="border-t border-line" />
          <SponsorSlot
            slot={2}
            initial={{ name: initial.sponsor2Name, url: initial.sponsor2Url, logoMediaId: initial.sponsor2LogoMediaId, logoUrl: initial.sponsor2LogoUrl }}
            errors={errors}
          />
        </div>
      </div>

      <div className="bg-paper border border-line p-5">
        <ImagePicker
          name="photoMediaId"
          label="Player photo"
          initialUrl={initial.photoUrl}
          initialMediaId={initial.photoMediaId}
          aspect="aspect-[3/4]"
        />
      </div>
    </Form>
  );
}

function SponsorSlot({
  slot,
  initial,
  errors,
}: {
  slot: 1 | 2;
  initial: { name?: string | null; url?: string | null; logoMediaId?: string | null; logoUrl?: string | null };
  errors: Record<string, string>;
}) {
  const prefix = `sponsor${slot}`;
  return (
    <div className="space-y-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-navy/60">Slot {slot}</div>
      <FormRow cols={2}>
        <Field name={`${prefix}Name`} label="Sponsor name" error={errors[`${prefix}Name`]}>
          <TextInput name={`${prefix}Name`} defaultValue={initial.name ?? ""} placeholder="Acme Ltd" />
        </Field>
        <Field name={`${prefix}Url`} label="Website" error={errors[`${prefix}Url`]}>
          <TextInput name={`${prefix}Url`} defaultValue={initial.url ?? ""} placeholder="https://…" />
        </Field>
      </FormRow>
      <ImagePicker
        name={`${prefix}LogoMediaId`}
        label="Logo"
        initialUrl={initial.logoUrl}
        initialMediaId={initial.logoMediaId}
        aspect="aspect-[3/1]"
      />
    </div>
  );
}
