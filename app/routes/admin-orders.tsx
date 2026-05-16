import { desc } from "drizzle-orm";
import { Link } from "react-router";
import type { Route } from "./+types/admin-orders";
import { db } from "~/db.server";
import { pitchOrders, shopOrders } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import {
  AdminPage,
  StatusPill,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Orders · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  const [pitch, shop] = await Promise.all([
    db.select().from(pitchOrders).orderBy(desc(pitchOrders.createdAt)).limit(100),
    db.select().from(shopOrders).orderBy(desc(shopOrders.createdAt)).limit(100),
  ]);
  return { pitch, shop };
}

export default function AdminOrders({ loaderData }: Route.ComponentProps) {
  const { pitch, shop } = loaderData;
  return (
    <AdminPage
      eyebrow="Money"
      title="Orders"
      description="Every payment in one place — pitch sponsorships and shop orders."
    >
      <section className="mb-12">
        <header className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl tracking-wider text-navy">
            PITCH SPONSORSHIPS
          </h2>
          <Link
            to="/admin/pitch"
            className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
          >
            Manage pitch →
          </Link>
        </header>
        {pitch.length === 0 ? (
          <EmptyOrders kind="pitch sponsorship" />
        ) : (
          <OrdersTable
            rows={pitch.map((o) => ({
              id: o.id,
              date: o.createdAt,
              who: o.displayName,
              email: o.email,
              detail: `${o.squareCount} square${o.squareCount === 1 ? "" : "s"}`,
              totalPence: o.totalPence,
              status: o.status,
            }))}
          />
        )}
      </section>

      <section>
        <header className="flex items-baseline justify-between mb-4">
          <h2 className="font-display text-xl tracking-wider text-navy">
            SHOP ORDERS
          </h2>
          <Link
            to="/admin/shop"
            className="text-xs uppercase tracking-[0.18em] text-navy hover:text-sky-bright"
          >
            Manage shop →
          </Link>
        </header>
        {shop.length === 0 ? (
          <EmptyOrders kind="shop order" />
        ) : (
          <OrdersTable
            rows={shop.map((o) => ({
              id: o.id,
              date: o.createdAt,
              who: o.email,
              email: o.email,
              detail: "—",
              totalPence: o.totalPence,
              status: o.status,
            }))}
          />
        )}
      </section>
    </AdminPage>
  );
}

function EmptyOrders({ kind }: { kind: string }) {
  return (
    <div className="bg-paper border border-line p-10 text-center text-mute text-sm">
      No {kind}s yet.
    </div>
  );
}

function OrdersTable({
  rows,
}: {
  rows: {
    id: string;
    date: Date;
    who: string;
    email: string;
    detail: string;
    totalPence: number;
    status: string;
  }[];
}) {
  return (
    <div className="bg-paper border border-line overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-paper-warm text-[10px] uppercase tracking-[0.22em] text-mute">
          <tr>
            <th className="text-left px-4 py-3 font-medium">Date</th>
            <th className="text-left px-4 py-3 font-medium">Buyer</th>
            <th className="text-left px-4 py-3 font-medium">Detail</th>
            <th className="text-left px-4 py-3 font-medium">Total</th>
            <th className="text-left px-4 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-3 text-xs text-mute whitespace-nowrap">
                {o.date.toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td className="px-4 py-3 text-ink">
                <div className="font-medium">{o.who}</div>
                {o.who !== o.email && (
                  <div className="text-xs text-mute">{o.email}</div>
                )}
              </td>
              <td className="px-4 py-3 text-mute text-xs">{o.detail}</td>
              <td className="px-4 py-3 text-ink">
                £{(o.totalPence / 100).toLocaleString("en-GB")}
              </td>
              <td className="px-4 py-3">
                {o.status === "paid" || o.status === "manual" ? (
                  <StatusPill status="ok" label={o.status} />
                ) : o.status === "pending" ? (
                  <StatusPill status="pending" label="Pending" />
                ) : (
                  <StatusPill status="muted" label={o.status} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
