import { variantUrl } from "~/lib/uploads";

export type StaffMember = {
  name: string;
  role: string;
  photoFilename: string | null;
  sponsor1Name?: string | null;
  sponsor1Url?: string | null;
  sponsor1LogoFilename?: string | null;
};

function ensureAbsolute(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
}

export function CoachingSection({ staff }: { staff: StaffMember[] }) {
  if (staff.length === 0) return null;
  return (
    <div className="mt-16 pt-12 border-t border-line">
      <div className="text-[10px] uppercase tracking-[0.28em] text-mute mb-8">
        Coaching &amp; management
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
        {staff.map((s) => (
          <div key={`${s.name}-${s.role}`} className="flex flex-col items-center gap-3 text-center py-6 px-4 border border-line bg-paper-warm/20">
            <div className="h-24 w-24 rounded-full overflow-hidden flex-shrink-0">
              {s.photoFilename ? (
                <img
                  src={variantUrl(s.photoFilename, 240, "jpeg")}
                  alt={s.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-navy flex items-center justify-center">
                  <span className="text-paper text-xl font-semibold tracking-wide">
                    {initials(s.name)}
                  </span>
                </div>
              )}
            </div>
            <div className="w-full">
              <div className="font-serif text-base text-navy leading-tight">{s.name}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-mute mt-1 leading-tight">
                {s.role}
              </div>
              {s.sponsor1Name && (() => {
                const url = ensureAbsolute(s.sponsor1Url ?? null);
                const inner = (
                  <div className="flex items-center gap-2 border border-line bg-paper-warm/30 px-2 py-1 min-w-0 mt-2">
                    {s.sponsor1LogoFilename && (
                      <img
                        src={variantUrl(s.sponsor1LogoFilename, 120, "jpeg")}
                        alt={s.sponsor1Name}
                        loading="lazy"
                        decoding="async"
                        className="h-4 w-auto max-w-[40px] object-contain flex-shrink-0"
                      />
                    )}
                    <span className="text-[9px] uppercase tracking-[0.14em] text-navy/70 font-semibold truncate">
                      {s.sponsor1Name}
                    </span>
                  </div>
                );
                return (
                  <div>
                    <div className="text-[9px] uppercase tracking-[0.14em] text-mute mt-2 mb-0.5">Sponsored by</div>
                    {url ? (
                      <a href={url} target="_blank" rel="noreferrer" className="block hover:opacity-80 transition-opacity">
                        {inner}
                      </a>
                    ) : inner}
                  </div>
                );
              })()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
