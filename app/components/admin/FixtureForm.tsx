import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, Select, TextArea, TextInput } from "./Field";
import { PrimaryButton } from "./AdminShell";

export type FixtureFormData = {
  competition?: string;
  opponent?: string;
  homeAway?: "home" | "away";
  kickoff?: Date | string;
  venue?: string | null;
  status?: "scheduled" | "in_progress" | "completed" | "postponed" | "cancelled";
  homeScore?: number | null;
  awayScore?: number | null;
  notes?: string | null;
};

function toLocalInput(d: Date | string | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function FixtureForm({
  initial = {},
  errors = {},
  submitLabel = "Save fixture",
}: {
  initial?: FixtureFormData;
  errors?: Record<string, string>;
  submitLabel?: string;
}) {
  const nav = useNavigation();
  const submitting = nav.state === "submitting";
  return (
    <Form method="post" className="bg-paper border border-line p-6 lg:p-8 max-w-3xl space-y-5">
      <FormRow cols={2}>
        <Field name="competition" label="Competition" error={errors.competition} required>
          <TextInput
            name="competition"
            defaultValue={initial.competition}
            placeholder="NCEL Premier"
            required
          />
        </Field>
        <Field name="opponent" label="Opponent" error={errors.opponent} required>
          <TextInput name="opponent" defaultValue={initial.opponent} required />
        </Field>
      </FormRow>

      <FormRow cols={2}>
        <Field name="homeAway" label="Home / away" error={errors.homeAway} required>
          <Select name="homeAway" defaultValue={initial.homeAway ?? "home"} required>
            <option value="home">Home</option>
            <option value="away">Away</option>
          </Select>
        </Field>
        <Field name="kickoff" label="Kick-off" error={errors.kickoff} required>
          <TextInput
            name="kickoff"
            type="datetime-local"
            defaultValue={toLocalInput(initial.kickoff)}
            required
          />
        </Field>
      </FormRow>

      <Field name="venue" label="Venue" error={errors.venue}>
        <TextInput
          name="venue"
          defaultValue={initial.venue ?? ""}
          placeholder="Eco-Power Stadium"
        />
      </Field>

      <FormRow cols={3}>
        <Field name="status" label="Status">
          <Select name="status" defaultValue={initial.status ?? "scheduled"}>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
            <option value="postponed">Postponed</option>
            <option value="cancelled">Cancelled</option>
          </Select>
        </Field>
        <Field name="homeScore" label="Home score">
          <TextInput
            name="homeScore"
            type="number"
            min={0}
            defaultValue={initial.homeScore ?? ""}
            placeholder="—"
          />
        </Field>
        <Field name="awayScore" label="Away score">
          <TextInput
            name="awayScore"
            type="number"
            min={0}
            defaultValue={initial.awayScore ?? ""}
            placeholder="—"
          />
        </Field>
      </FormRow>

      <Field name="notes" label="Notes" hint="Optional — admin-only" error={errors.notes}>
        <TextArea name="notes" defaultValue={initial.notes ?? ""} rows={3} />
      </Field>

      <div className="flex items-center gap-3 pt-2">
        <PrimaryButton type="submit" disabled={submitting}>
          {submitting ? "Saving…" : submitLabel}
        </PrimaryButton>
        <Link
          to="/admin/fixtures"
          className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
        >
          Cancel
        </Link>
      </div>
    </Form>
  );
}
