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
      <div className="flex flex-wrap gap-6">
        {staff.map((s) => (
          <div key={`${s.name}-${s.role}`} className="flex flex-col items-center gap-2 w-24 text-center">
            <div className="h-16 w-16 rounded-full overflow-hidden flex-shrink-0">
              {s.photoFilename ? (
                <img
                  src={variantUrl(s.photoFilename, 120, "jpeg")}
                  alt={s.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-navy flex items-center justify-center">
                  <span className="text-paper text-sm font-semibold tracking-wide">
                    {initials(s.name)}
                  </span>
                </div>
              )}
            </div>
            <div>
              <div className="font-serif text-sm text-navy leading-tight">{s.name}</div>
              <div className="text-[9px] uppercase tracking-[0.16em] text-mute mt-0.5 leading-tight">
                {s.role}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
