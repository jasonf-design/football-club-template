import { Container } from "./Container";

export function PageHeader({
  eyebrow,
  title,
  lede,
  children,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="bg-paper-warm border-b border-line">
      <Container size="wide" className="py-16 md:py-24">
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-8 items-end">
          <div className="max-w-3xl">
            {eyebrow && (
              <div className="text-[10px] uppercase tracking-[0.28em] text-sky-bright mb-4">
                {eyebrow}
              </div>
            )}
            <h1 className="font-serif text-5xl md:text-6xl text-navy leading-[1.02] tracking-tight text-balance">
              {title}
            </h1>
            {lede && (
              <p className="mt-6 text-mute text-lg leading-relaxed max-w-2xl">
                {lede}
              </p>
            )}
          </div>
          {children && <div>{children}</div>}
        </div>
      </Container>
    </section>
  );
}
