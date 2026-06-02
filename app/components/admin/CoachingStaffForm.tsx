import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, Select, TextInput } from "./Field";
import { ImagePicker } from "./ImagePicker";
import { PrimaryButton } from "./AdminShell";

export const COACHING_ROLES = [
  "Manager",
  "Head Coach",
  "Assistant Manager",
  "Coach",
  "Goalkeeper Coach",
  "Assistant Goalkeeper Coach",
  "Fitness Coach",
  "Physiotherapist",
  "Sports Therapist",
  "First Aider",
  "Club Doctor",
  "Kit Manager",
  "Youth Development Coach",
  "Safeguarding Officer",
];

export type CoachingStaffFormData = {
  team?: "first" | "u23" | "u18" | null;
  name?: string;
  role?: string | null;
  photoMediaId?: string | null;
  photoUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
};

export function CoachingStaffForm({
  initial = {},
  errors = {},
  submitLabel = "Save",
}: {
  initial?: CoachingStaffFormData;
  errors?: Record<string, string>;
  submitLabel?: string;
}) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  return (
    <Form method="post" className="max-w-2xl space-y-6">
      <div className="bg-paper border border-line p-6 lg:p-8 space-y-5">
        <Field name="team" label="Team">
          <Select name="team" defaultValue={initial.team ?? "first"}>
            <option value="first">1st Team</option>
            <option value="u23">Under 23s</option>
            <option value="u18">Under 18s</option>
          </Select>
        </Field>

        <Field name="name" label="Name" error={errors.name} required>
          <TextInput
            name="name"
            defaultValue={initial.name}
            placeholder="Jamie Smith"
            required
          />
        </Field>

        <Field name="role" label="Role" error={errors.role} required>
          <Select name="role" defaultValue={initial.role ?? ""} required>
            <option value="" disabled>Select a role…</option>
            {COACHING_ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </Select>
        </Field>

        <FormRow cols={2}>
          <Field name="sortOrder" label="Sort order" hint="Lower numbers appear first">
            <TextInput name="sortOrder" type="number" defaultValue={initial.sortOrder ?? 0} />
          </Field>
          <Field name="active" label="Visible">
            <label className="flex items-center gap-2 mt-1 text-sm">
              <input
                type="checkbox"
                name="active"
                defaultChecked={initial.active ?? true}
                className="h-4 w-4 accent-navy"
              />
              <span>Show on team page</span>
            </label>
          </Field>
        </FormRow>

        <div className="flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </PrimaryButton>
          <Link
            to="/admin/coaching"
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="bg-paper border border-line p-5 max-w-xs">
        <ImagePicker
          name="photoMediaId"
          label="Photo"
          initialUrl={initial.photoUrl}
          initialMediaId={initial.photoMediaId}
          aspect="aspect-[1/1]"
        />
      </div>
    </Form>
  );
}
