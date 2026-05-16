import type { Route } from "./+types/admin-logout";
import { destroyUserSession } from "~/lib/session.server";
import { redirect } from "react-router";

export async function loader() {
  throw redirect("/admin/login");
}

export async function action({ request }: Route.ActionArgs) {
  return destroyUserSession(request, "/admin/login");
}
