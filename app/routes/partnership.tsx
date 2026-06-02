import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router";
import type { Route } from "./+types/partnership";

export function meta(_: Route.MetaArgs) {
  return [
    { title: "Commercial Partnerships · Doncaster City FC" },
    {
      name: "description",
      content:
        "Partner with Doncaster City FC for the 2026/27 season. Explore our partnership brochure.",
    },
  ];
}

export default function Partnership() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [params] = useSearchParams();
  const submitted = params.get("submitted") === "1";
  const error = params.get("error") === "1";

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    let timer: ReturnType<typeof setTimeout>;
    let stable = 0;
    let last = 0;

    const measure = () => {
      try {
        const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0;
        if (h > 100) {
          iframe.style.height = h + "px";
          if (h === last) {
            stable++;
          } else {
            stable = 0;
            last = h;
          }
        }
        if (stable < 3) {
          timer = setTimeout(measure, 400);
        }
      } catch {
        // cross-origin guard
      }
    };

    iframe.addEventListener("load", measure);
    timer = setTimeout(measure, 200);

    return () => {
      clearTimeout(timer);
      iframe.removeEventListener("load", measure);
    };
  }, []);

  return (
    <>
      {submitted && (
        <div className="bg-navy text-paper px-6 py-4 text-center text-sm font-medium tracking-wide">
          Thanks — we&apos;ll be in touch within 2 working days.
        </div>
      )}
      {error && (
        <div className="bg-red/10 text-red px-6 py-4 text-center text-sm font-medium tracking-wide">
          Something went wrong — please check your details and try again.
        </div>
      )}
      {/* Portrait mobile nudge — hidden in landscape and on wider screens */}
      <div className="flex flex-col items-center justify-center gap-4 py-16 px-8 text-center sm:hidden landscape:hidden">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-navy/40">
          <rect x="5" y="2" width="14" height="20" rx="2" />
          <path d="M12 18h.01" />
        </svg>
        <p className="text-navy font-medium">Rotate your device</p>
        <p className="text-sm text-mute max-w-xs">This brochure is best viewed in landscape mode or on a larger screen.</p>
      </div>

      <div className="hidden sm:block landscape:block" style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" as never }}>
        <iframe
          ref={iframeRef}
          src="/partnership-brochure.html"
          title="Doncaster City FC 2026/27 Partnership Brochure"
          style={{ width: "100%", minWidth: "800px", minHeight: "100vh", border: "none", display: "block" }}
        />
      </div>
    </>
  );
}
