import { Form, Link, useNavigation } from "react-router";
import { Field, FormRow, TextArea, TextInput } from "./Field";
import { ImagePicker } from "./ImagePicker";
import { PrimaryButton } from "./AdminShell";

export type ProductFormData = {
  name?: string;
  slug?: string;
  description?: string | null;
  pricePence?: number;
  stock?: number | null;
  imageMediaId?: string | null;
  imageUrl?: string | null;
  active?: boolean;
  sortOrder?: number;
};

export function ProductForm({
  initial = {},
  errors = {},
  submitLabel = "Save product",
}: {
  initial?: ProductFormData;
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
        <Field name="name" label="Name" error={errors.name} required>
          <TextInput
            name="name"
            defaultValue={initial.name}
            placeholder="Home shirt 25/26"
            required
            className="text-xl font-serif !py-3"
          />
        </Field>
        <FormRow cols={2}>
          <Field
            name="slug"
            label="URL slug"
            hint="Auto-generated if blank"
            error={errors.slug}
          >
            <TextInput
              name="slug"
              defaultValue={initial.slug}
              placeholder="home-shirt-25-26"
            />
          </Field>
          <Field name="pricePence" label="Price (pence)" error={errors.pricePence} required>
            <TextInput
              name="pricePence"
              type="number"
              min={0}
              step={50}
              defaultValue={initial.pricePence ?? 0}
              required
              placeholder="3500"
            />
          </Field>
        </FormRow>
        <Field
          name="description"
          label="Description"
          hint="Plain text, shown on the product page"
          error={errors.description}
        >
          <TextArea
            name="description"
            defaultValue={initial.description ?? ""}
            rows={6}
          />
        </Field>
        <FormRow cols={3}>
          <Field
            name="stock"
            label="Stock"
            hint="Leave blank for unlimited"
            error={errors.stock}
          >
            <TextInput
              name="stock"
              type="number"
              min={0}
              defaultValue={initial.stock ?? ""}
              placeholder="—"
            />
          </Field>
          <Field name="sortOrder" label="Sort order" hint="Lower first">
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
              <span>On the public shop</span>
            </label>
          </Field>
        </FormRow>
        <div className="flex items-center gap-3 pt-2">
          <PrimaryButton type="submit" disabled={submitting}>
            {submitting ? "Saving…" : submitLabel}
          </PrimaryButton>
          <Link
            to="/admin/shop"
            className="text-xs uppercase tracking-[0.18em] text-mute hover:text-navy"
          >
            Cancel
          </Link>
        </div>
      </div>
      <div className="bg-paper border border-line p-5">
        <ImagePicker
          name="imageMediaId"
          label="Product image"
          initialUrl={initial.imageUrl}
          initialMediaId={initial.imageMediaId}
          aspect="aspect-square"
        />
      </div>
    </Form>
  );
}
