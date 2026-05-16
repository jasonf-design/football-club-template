import { data } from "react-router";
import type { Route } from "./+types/admin-upload";
import { requireAdmin } from "~/lib/session.server";
import { saveImage, UploadError } from "~/lib/uploads.server";

export async function loader() {
  throw data("Method Not Allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireAdmin(request);
  if (request.method !== "POST") {
    throw data("Method Not Allowed", { status: 405 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw data({ error: "Couldn't parse upload" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw data({ error: "No file in upload" }, { status: 400 });
  }
  const alt = (formData.get("alt") as string | null) ?? null;

  try {
    const saved = await saveImage(file, { alt, uploadedBy: user.id });
    return saved;
  } catch (err) {
    if (err instanceof UploadError) {
      throw data({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
