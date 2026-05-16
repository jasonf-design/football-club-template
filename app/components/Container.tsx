import { type ReactNode } from "react";

export function Container({
  children,
  className = "",
  size = "default",
}: {
  children: ReactNode;
  className?: string;
  size?: "default" | "wide" | "narrow";
}) {
  const max = {
    narrow: "max-w-3xl",
    default: "max-w-6xl",
    wide: "max-w-[88rem]",
  }[size];
  return (
    <div className={`${max} mx-auto px-5 sm:px-8 ${className}`}>{children}</div>
  );
}
