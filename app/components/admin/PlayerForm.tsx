import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, Select, TextArea, TextInput } from "./Field";
import { ImagePicker } from "./ImagePicker";
import { PrimaryButton } from "./AdminShell";

export type PlayerFormData = {
  name?: string;
  position?: string | null;
  shirtNumber?: number | null;
  bio?: string | null;
  photoMediaId?: string | null;
  photoUrl?: string | null;
  sortOrder?: number;
  active?: boolean;
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
          <Field name="position" label="Position" error={errors.position}>
            <Select name="position" defaultValue={initial.position ?? ""}>
              <option value="">—</option>
              {POSITIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            name="shirtNumber"
            label="Shirt number"
            error={errors.shirtNumber}
          >
            <TextInput
              name="shirtNumber"
              type="number"
              min={1}
              max={99}
              defaultValue={initial.shirtNumber ?? ""}
            />
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
              <span>On the public squad page</span>
            </label>
          </Field>
        </FormRow>
        <div className="flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </PrimaryButton>
          <Link
            to="/admin/players"
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
          >
            Cancel
          </Link>
        </div>
      </div>

      <div className="bg-paper border border-line p-5">
        <ImagePicker
          name="photoMediaId"
          label="Photo"
          initialUrl={initial.photoUrl}
          initialMediaId={initial.photoMediaId}
          aspect="aspect-[3/4]"
        />
      </div>
    </Form>
  );
}
