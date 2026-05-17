import { Link, type To } from "react-router";

export function AdminPage({
  title,
  eyebrow,
  description,
  actions,
  children,
}: {
  title: string;
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="p-8 md:p-12 max-w-[110rem]">
      <header className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
        <div>
          {eyebrow && (
            <div className="text-[10px] uppercase tracking-[0.28em] text-sky-deep mb-2">
              {eyebrow}
            </div>
          )}
          <h1 className="font-serif text-4xl text-navy leading-tight">
            {title}
          </h1>
          {description && (
            <p className="mt-2 text-mute max-w-2xl">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
      </header>
      {children}
    </div>
  );
}

export function AdminBreadcrumbs({
  items,
}: {
  items: { label: string; to?: To }[];
}) {
  return (
    <nav className="text-xs text-mute mb-4 flex items-center gap-2">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-2">
          {item.to ? (
            <Link
              to={item.to}
              className="hover:text-navy underline-offset-4 hover:underline"
            >
              {item.label}
            </Link>
          ) : (
            <span className="text-ink">{item.label}</span>
          )}
          {i < items.length - 1 && (
            <span className="text-line">/</span>
          )}
        </span>
      ))}
    </nav>
  );
}

export function PrimaryButton({
  type = "button",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className="inline-flex items-center gap-2 bg-navy text-paper px-5 py-2.5 text-xs font-semibold tracking-[0.18em] uppercase hover:bg-navy-deep transition-colors disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}

export function SecondaryButton({
  type = "button",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className="inline-flex items-center gap-2 border border-line bg-paper text-ink px-5 py-2.5 text-xs font-medium tracking-[0.18em] uppercase hover:border-navy hover:text-navy transition-colors disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}

export function DangerButton({
  type = "submit",
  children,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className="inline-flex items-center gap-2 border border-red/30 text-red px-4 py-2 text-xs font-medium tracking-[0.18em] uppercase hover:bg-red hover:text-paper transition-colors"
      {...rest}
    >
      {children}
    </button>
  );
}

export function LinkButton({
  to,
  children,
  variant = "primary",
}: {
  to: To;
  children: React.ReactNode;
  variant?: "primary" | "secondary";
}) {
  const cls =
    variant === "primary"
      ? "inline-flex items-center gap-2 bg-navy text-paper px-5 py-2.5 text-xs font-semibold tracking-[0.18em] uppercase hover:bg-navy-deep transition-colors"
      : "inline-flex items-center gap-2 border border-line bg-paper text-ink px-5 py-2.5 text-xs font-medium tracking-[0.18em] uppercase hover:border-navy hover:text-navy transition-colors";
  return (
    <Link to={to} className={cls}>
      {children}
    </Link>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return <div className="bg-paper border border-line">{children}</div>;
}

export function Table({
  head,
  children,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-paper border border-line overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-paper-warm text-[10px] uppercase tracking-[0.22em] text-mute">
          <tr>{head}</tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
    </div>
  );
}

export function Th({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th className={`text-left font-medium px-4 py-3 ${className}`}>
      {children}
    </th>
  );
}

export function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-4 py-3.5 align-middle ${className}`}>{children}</td>;
}

export function StatusPill({
  status,
  label,
}: {
  status: "ok" | "pending" | "draft" | "muted" | "warn";
  label: string;
}) {
  const styles = {
    ok: "bg-green/10 text-green border-green/20",
    pending: "bg-cream text-navy border-cream",
    draft: "bg-line text-mute border-line",
    muted: "bg-line/50 text-mute border-line",
    warn: "bg-red/10 text-red border-red/20",
  }[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] ${styles}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          {
            ok: "bg-green",
            pending: "bg-mute",
            draft: "bg-mute",
            muted: "bg-mute",
            warn: "bg-red",
          }[status]
        }`}
      />
      {label}
    </span>
  );
}
