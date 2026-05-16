import { type ReactNode } from "react";

export function Field({
  name,
  label,
  hint,
  error,
  required,
  children,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-[10px] uppercase tracking-[0.24em] text-mute">
          {label}
          {required && <span className="text-red ml-1">*</span>}
        </span>
        {hint && <span className="text-[11px] text-mute/80">{hint}</span>}
      </div>
      {children}
      {error && <div className="mt-1.5 text-xs text-red">{error}</div>}
    </label>
  );
}

const baseInput =
  "w-full bg-paper border border-line focus:border-navy outline-none px-3.5 py-2.5 text-sm text-ink transition-colors";

export function TextInput(
  props: React.InputHTMLAttributes<HTMLInputElement>,
) {
  return <input {...props} className={`${baseInput} ${props.className ?? ""}`} />;
}

export function TextArea(
  props: React.TextareaHTMLAttributes<HTMLTextAreaElement>,
) {
  return (
    <textarea {...props} className={`${baseInput} ${props.className ?? ""}`} />
  );
}

export function Select(
  props: React.SelectHTMLAttributes<HTMLSelectElement>,
) {
  return (
    <select {...props} className={`${baseInput} ${props.className ?? ""}`} />
  );
}

export function FormRow({
  children,
  cols = 2,
}: {
  children: ReactNode;
  cols?: 1 | 2 | 3 | 4;
}) {
  const gridCols = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-3",
    4: "grid-cols-1 sm:grid-cols-4",
  }[cols];
  return <div className={`grid ${gridCols} gap-5`}>{children}</div>;
}
