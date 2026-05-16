import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { Form, Link, redirect, useSearchParams } from "react-router";
import { z } from "zod";
import type { Route } from "./+types/admin-pitch";
import { db } from "~/db.server";
import { pitchOrders, pitchSquares } from "../../db/schema";
import { requireAdmin } from "~/lib/session.server";
import { expireStaleHolds } from "~/lib/pitch.server";
import {
  AdminPage,
  Card,
  DangerButton,
  LinkButton,
  PrimaryButton,
  SecondaryButton,
  StatusPill,
} from "~/components/admin/AdminShell";

export function meta(_: Route.MetaArgs) {
  return [{ title: "Pitch sponsorship · Admin" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  await requireAdmin(request);
  await expireStaleHolds();

  const url = new URL(request.url);
  const squareId = url.searchParams.get("square");

  const squares = await db
    .select()
    .from(pitchSquares)
    .orderBy(asc(pitchSquares.row), asc(pitchSquares.col));

  const rows = squares.length === 0 ? 0 : Math.max(...squares.map((s) => s.row));
  const cols = squares.length === 0 ? 0 : Math.max(...squares.map((s) => s.col));
  const pricePence = squares[0]?.pricePence ?? 5000;
  const sold = squares.filter((s) => s.status === "sold").length;
  const pending = squares.filter((s) => s.status === "pending").length;

  const recentOrders = await db
    .select()
    .from(pitchOrders)
    .orderBy(desc(pitchOrders.createdAt))
    .limit(20);

  let selected: typeof squares[number] | null = null;
  let selectedOrder: typeof recentOrders[number] | null = null;
  if (squareId) {
    const id = Number(squareId);
    selected = squares.find((s) => s.id === id) ?? null;
    if (selected?.orderId) {
      const [o] = await db
        .select()
        .from(pitchOrders)
        .where(eq(pitchOrders.id, selected.orderId))
        .limit(1);
      selectedOrder = o ?? null;
    }
  }

  return {
    squares,
    config: { rows, cols, pricePence },
    sold,
    pending,
    raisedPence: sold * pricePence,
    goalPence: squares.length * pricePence,
    recentOrders,
    selected,
    selectedOrder,
  };
}

const editSchema = z.object({
  intent: z.enum(["mark_sold", "mark_available", "edit_name"]),
  squareId: z.string(),
  sponsorName: z.string().max(120).optional(),
  email: z.string().email().optional().or(z.literal("")),
});

export async function action({ request }: Route.ActionArgs) {
  await requireAdmin(request);
  const form = await request.formData();
  const parsed = editSchema.safeParse({
    intent: form.get("intent"),
    squareId: form.get("squareId"),
    sponsorName: form.get("sponsorName") || undefined,
    email: form.get("email") || undefined,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const id = Number(parsed.data.squareId);
  if (!Number.isInteger(id)) return { error: "Invalid square id" };

  const [square] = await db
    .select()
    .from(pitchSquares)
    .where(eq(pitchSquares.id, id))
    .limit(1);
  if (!square) return { error: "Square not found" };

  if (parsed.data.intent === "mark_available") {
    // Free the square. Cancel any pending order tied to it; leave paid orders
    // alone (a refund flow lives elsewhere).
    if (square.orderId) {
      const [order] = await db
        .select()
        .from(pitchOrders)
        .where(eq(pitchOrders.id, square.orderId))
        .limit(1);
      if (order && order.status === "pending") {
        const held = await db
          .select({ id: pitchSquares.id })
          .from(pitchSquares)
          .where(eq(pitchSquares.orderId, order.id));
        await db
          .update(pitchSquares)
          .set({ status: "available", orderId: null, sponsorName: null })
          .where(
            inArray(
              pitchSquares.id,
              held.map((s) => s.id),
            ),
          );
        await db
          .update(pitchOrders)
          .set({ status: "cancelled" })
          .where(eq(pitchOrders.id, order.id));
      } else {
        await db
          .update(pitchSquares)
          .set({ status: "available", orderId: null, sponsorName: null })
          .where(eq(pitchSquares.id, id));
      }
    } else {
      await db
        .update(pitchSquares)
        .set({ status: "available", sponsorName: null })
        .where(eq(pitchSquares.id, id));
    }
    throw redirect(`/admin/pitch?square=${id}`);
  }

  if (parsed.data.intent === "mark_sold") {
    const sponsorName = parsed.data.sponsorName?.trim();
    if (!sponsorName) return { error: "Display name is required" };
    // Create a manual order so the data stays consistent with online orders.
    const [order] = await db
      .insert(pitchOrders)
      .values({
        email: parsed.data.email || "manual@dcfc.local",
        displayName: sponsorName,
        totalPence: square.pricePence,
        squareCount: 1,
        status: "manual",
        paidAt: new Date(),
      })
      .returning();
    await db
      .update(pitchSquares)
      .set({
        status: "sold",
        sponsorName,
        orderId: order.id,
      })
      .where(eq(pitchSquares.id, id));
    throw redirect(`/admin/pitch?square=${id}`);
  }

  if (parsed.data.intent === "edit_name") {
    const sponsorName = parsed.data.sponsorName?.trim();
    if (!sponsorName) return { error: "Display name is required" };
    await db
      .update(pitchSquares)
      .set({ sponsorName })
      .where(eq(pitchSquares.id, id));
    // Keep the source order display name in sync if there is one.
    if (square.orderId) {
      await db
        .update(pitchOrders)
        .set({ displayName: sponsorName })
        .where(eq(pitchOrders.id, square.orderId));
    }
    throw redirect(`/admin/pitch?square=${id}`);
  }

  return { error: "Unknown action" };
}

export default function AdminPitch({ loaderData }: Route.ComponentProps) {
  const {
    squares,
    config,
    sold,
    pending,
    raisedPence,
    goalPence,
    recentOrders,
    selected,
    selectedOrder,
  } = loaderData;

  if (squares.length === 0) {
    return (
      <AdminPage eyebrow="Pitch" title="Pitch sponsorship">
        <Card>
          <div className="p-10 text-center">
            <div className="font-serif text-2xl text-navy">
              No pitch squares seeded.
            </div>
            <p className="mt-2 text-mute text-sm">
              Run <code>npm run pitch:seed</code> to lay out the 15×10 grid at
              £50 a square.
            </p>
          </div>
        </Card>
      </AdminPage>
    );
  }

  const percent =
    goalPence > 0 ? Math.round((raisedPence / goalPence) * 100) : 0;

  return (
    <AdminPage
      eyebrow="Pitch"
      title="Pitch sponsorship"
      description="Click any square to manage it. Sold and pending squares can be edited or released."
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-px bg-line border border-line mb-8">
        <Tile label="Sold" value={sold} />
        <Tile label="Pending" value={pending} />
        <Tile label="Available" value={squares.length - sold - pending} />
        <Tile
          label="Raised"
          value={`£${(raisedPence / 100).toLocaleString("en-GB")}`}
          hint={`${percent}% of goal`}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-8">
        <AdminGrid
          squares={squares}
          config={config}
          selectedId={selected?.id ?? null}
        />
        <SquarePanel selected={selected} order={selectedOrder} />
      </div>

      <section className="mt-12">
        <h2 className="font-display text-xl tracking-wider text-navy mb-4">
          RECENT ORDERS
        </h2>
        {recentOrders.length === 0 ? (
          <Card>
            <div className="p-8 text-center text-mute text-sm">
              No orders yet.
            </div>
          </Card>
        ) : (
          <div className="bg-paper border border-line overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-paper-warm text-[10px] uppercase tracking-[0.22em] text-mute">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Date</th>
                  <th className="text-left px-4 py-3 font-medium">Display name</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Squares</th>
                  <th className="text-left px-4 py-3 font-medium">Total</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {recentOrders.map((o) => (
                  <tr key={o.id}>
                    <td className="px-4 py-3 text-xs text-mute">
                      {o.createdAt.toLocaleDateString("en-GB")}
                    </td>
                    <td className="px-4 py-3 font-medium text-ink">
                      {o.displayName}
                    </td>
                    <td className="px-4 py-3 text-xs text-mute">{o.email}</td>
                    <td className="px-4 py-3 scoreboard text-lg text-navy">
                      {o.squareCount}
                    </td>
                    <td className="px-4 py-3 text-ink">
                      £{(o.totalPence / 100).toLocaleString("en-GB")}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusPill status={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminPage>
  );
}

function Tile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="bg-paper p-5">
      <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
        {label}
      </div>
      <div className="scoreboard text-3xl text-navy mt-1.5 leading-none">
        {value}
      </div>
      {hint && <div className="text-xs text-mute mt-2">{hint}</div>}
    </div>
  );
}

function AdminGrid({
  squares,
  config,
  selectedId,
}: {
  squares: { id: number; row: number; col: number; zone: string; status: string; sponsorName: string | null }[];
  config: { rows: number; cols: number };
  selectedId: number | null;
}) {
  const [params] = useSearchParams();
  const zoneOrder: string[] = [];
  const zonesSeen = new Set<string>();
  for (const s of squares) {
    if (!zonesSeen.has(s.zone)) {
      zonesSeen.add(s.zone);
      zoneOrder.push(s.zone);
    }
  }
  const byZone = new Map<string, typeof squares>();
  for (const s of squares) {
    const arr = byZone.get(s.zone) ?? [];
    arr.push(s);
    byZone.set(s.zone, arr);
  }
  for (const arr of byZone.values()) {
    arr.sort((a, b) => a.row - b.row || a.col - b.col);
  }
  return (
    <div className="bg-navy/95 p-4 rounded-sm">
      {zoneOrder.map((zone, zi) => (
        <div key={zone} className={zi > 0 ? "mt-3" : ""}>
          <div className="flex items-center gap-3 mb-2 text-[10px] uppercase tracking-[0.22em] text-sky/70">
            <span>{zone}</span>
            <span className="flex-1 h-px bg-sky/15" />
          </div>
          <div
            className="grid gap-[3px]"
            style={{ gridTemplateColumns: `repeat(${config.cols}, minmax(0, 1fr))` }}
          >
            {(byZone.get(zone) ?? []).map((s) => {
              const isSelected = selectedId === s.id;
              const color =
                s.status === "sold"
                  ? "bg-sky text-navy"
                  : s.status === "pending"
                    ? "bg-cream/80 text-mute"
                    : "bg-paper/[0.08] text-paper/30 hover:bg-paper/20";
              return (
                <Link
                  key={s.id}
                  to={`/admin/pitch?square=${s.id}`}
                  preventScrollReset
                  className={[
                    "aspect-square flex items-center justify-center text-[9px] transition-colors",
                    color,
                    isSelected ? "ring-2 ring-paper" : "",
                  ].join(" ")}
                  title={s.sponsorName ?? s.status}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function SquarePanel({
  selected,
  order,
}: {
  selected: {
    id: number;
    row: number;
    col: number;
    zone: string;
    status: string;
    sponsorName: string | null;
    pricePence: number;
  } | null;
  order: {
    id: string;
    displayName: string;
    email: string;
    totalPence: number;
    squareCount: number;
    status: string;
    createdAt: Date;
    stripePaymentIntentId: string | null;
  } | null;
}) {
  if (!selected) {
    return (
      <aside className="bg-paper border border-line p-6">
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-2">
          Manage a square
        </div>
        <p className="text-sm text-mute leading-relaxed">
          Click any square on the pitch to edit it. You can mark squares sold
          manually (for cheque/cash payments), edit the displayed name, or
          release them back into the available pool.
        </p>
      </aside>
    );
  }
  return (
    <aside className="bg-paper border border-line p-6 space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-1">
          {selected.zone}
        </div>
        <div className="font-serif text-2xl text-navy">
          Row {selected.row} · Column {selected.col}
        </div>
        <div className="mt-2">
          <StatusBadge status={selected.status} />
        </div>
      </div>

      {order && (
        <div className="bg-paper-warm border border-line p-4 text-xs space-y-1.5">
          <div className="text-[10px] uppercase tracking-[0.22em] text-mute">
            Linked order
          </div>
          <div>
            <span className="text-mute">Display name:</span>{" "}
            <strong className="text-ink">{order.displayName}</strong>
          </div>
          <div>
            <span className="text-mute">Email:</span> {order.email}
          </div>
          <div>
            <span className="text-mute">Squares:</span> {order.squareCount}
          </div>
          <div>
            <span className="text-mute">Total:</span> £
            {(order.totalPence / 100).toLocaleString("en-GB")}
          </div>
          <div>
            <span className="text-mute">Status:</span> {order.status}
          </div>
          {order.stripePaymentIntentId && (
            <div className="font-mono text-[10px] text-mute truncate">
              {order.stripePaymentIntentId}
            </div>
          )}
        </div>
      )}

      {selected.status === "available" ? (
        <Form method="post" className="space-y-3">
          <input type="hidden" name="intent" value="mark_sold" />
          <input type="hidden" name="squareId" value={selected.id} />
          <FormField
            name="sponsorName"
            label="Display name"
            required
            placeholder="Name to show on the pitch"
          />
          <FormField
            name="email"
            label="Email"
            type="email"
            hint="Optional — for your records"
          />
          <PrimaryButton type="submit">Mark sold manually</PrimaryButton>
          <div className="text-[11px] text-mute">
            Use this for cheque or cash payments — bypasses Stripe.
          </div>
        </Form>
      ) : (
        <>
          <Form method="post" className="space-y-3">
            <input type="hidden" name="intent" value="edit_name" />
            <input type="hidden" name="squareId" value={selected.id} />
            <FormField
              name="sponsorName"
              label="Display name"
              defaultValue={selected.sponsorName ?? ""}
              required
            />
            <SecondaryButton type="submit">Update name</SecondaryButton>
          </Form>
          <Form method="post" className="pt-3 border-t border-line">
            <input type="hidden" name="intent" value="mark_available" />
            <input type="hidden" name="squareId" value={selected.id} />
            <DangerButton
              type="submit"
              onClick={(e) => {
                if (
                  !confirm(
                    "Release this square back into the pool? Any linked pending order will be cancelled.",
                  )
                ) {
                  e.preventDefault();
                }
              }}
            >
              Release square
            </DangerButton>
          </Form>
        </>
      )}
    </aside>
  );
}

function FormField({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
  hint,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[10px] uppercase tracking-[0.24em] text-mute">
          {label}
          {required && <span className="text-red ml-1">*</span>}
        </span>
        {hint && <span className="text-[10px] text-mute/70">{hint}</span>}
      </div>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required={required}
        className="w-full bg-paper border border-line focus:border-navy outline-none px-3 py-2 text-sm text-ink"
      />
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "sold") return <StatusPill status="ok" label="Sold" />;
  if (status === "pending")
    return <StatusPill status="pending" label="Pending payment" />;
  return <StatusPill status="muted" label="Available" />;
}

function OrderStatusPill({ status }: { status: string }) {
  if (status === "paid") return <StatusPill status="ok" label="Paid" />;
  if (status === "manual") return <StatusPill status="ok" label="Manual" />;
  if (status === "pending") return <StatusPill status="pending" label="Pending" />;
  if (status === "refunded")
    return <StatusPill status="warn" label="Refunded" />;
  return <StatusPill status="muted" label={status} />;
}
