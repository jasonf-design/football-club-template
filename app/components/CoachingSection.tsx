import { variantUrl } from "~/lib/uploads";

export type StaffMember = {
  name: string;
  role: string;
  photoFilename: string | null;
};

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
            <div>
              <div className="font-serif text-base text-navy leading-tight">{s.name}</div>
              <div className="text-[9px] uppercase tracking-[0.18em] text-mute mt-1 leading-tight">
                {s.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
