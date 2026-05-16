import { Outlet, useLoaderData } from "react-router";
import type { Route } from "./+types/admin-layout";
import { requireAdmin } from "~/lib/session.server";
import { AdminSidebar } from "~/components/AdminSidebar";

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireAdmin(request);
  return {
    user: { name: user.name, email: user.email, role: user.role },
  };
}

export default function AdminLayout() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <div className="min-h-screen flex bg-paper-warm">
      <AdminSidebar user={user} />
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
