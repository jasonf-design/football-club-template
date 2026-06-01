import { useEffect, useRef } from "react";
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
        // Keep polling until height is stable for 3 checks, or 12s has passed
        if (stable < 3) {
          timer = setTimeout(measure, 400);
        }
      } catch {
        // cross-origin guard (shouldn't happen — same origin)
      }
    };

    iframe.addEventListener("load", measure);
    // Kick off early in case load already fired
    timer = setTimeout(measure, 200);

    return () => {
      clearTimeout(timer);
      iframe.removeEventListener("load", measure);
    };
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src="/partnership-brochure.html"
      title="Doncaster City FC 2026/27 Partnership Brochure"
      style={{ width: "100%", minHeight: "100vh", border: "none", display: "block", overflow: "hidden" }}
    />
  );
}
