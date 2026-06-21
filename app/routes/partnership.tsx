import { useEffect, useRef, useState } from "react";
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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [params] = useSearchParams();
  const submitted = params.get("submitted") === "1";
  const error = params.get("error") === "1";
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!loaded) return;
    const iframe = iframeRef.current;
    const wrapper = wrapperRef.current;
    if (!iframe || !wrapper) return;

    let timer: ReturnType<typeof setTimeout>;
    let lastH = 0;

    const applyScale = () => {
      try {
        const doc = iframe.contentDocument?.documentElement;
        if (!doc) return;
        const contentW = doc.scrollWidth;
        const contentH = doc.scrollHeight;
        if (contentW < 100 || contentH < 100) return;

        const wrapperW = wrapper.clientWidth;
        const scale = wrapperW / contentW;

        iframe.style.width = `${contentW}px`;
        iframe.style.height = `${contentH}px`;
        iframe.style.transform = `scale(${scale})`;
        iframe.style.transformOrigin = "top left";
        setScaledHeight(Math.ceil(contentH * scale));
      } catch {
        // cross-origin guard
      }
    };

    const startPolling = () => {
      let ticks = 0;
      const MAX_TICKS = 40;
      const poll = () => {
        if (ticks++ >= MAX_TICKS) return;
        try {
          const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0;
          if (h > 100 && h !== lastH) { lastH = h; applyScale(); }
        } catch { /* cross-origin */ }
        timer = setTimeout(poll, 500);
      };
      timer = setTimeout(poll, 300);
    };

    const onLoad = () => startPolling();
    const onResize = () => applyScale();

    iframe.addEventListener("load", onLoad);
    window.addEventListener("resize", onResize);

    return () => {
      clearTimeout(timer);
      iframe.removeEventListener("load", onLoad);
      window.removeEventListener("resize", onResize);
    };
  }, [loaded]);

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

      {!loaded ? (
        <div className="flex flex-col items-center justify-center min-h-[70svh] gap-8 px-6 text-center bg-paper-warm/40">
          <svg width="120" height="120" viewBox="0 0 240 240" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="240" height="240" fill="#0c2a4f" rx="8" />
            <circle cx="120" cy="120" r="60" fill="none" stroke="#67B7FF" strokeWidth="6" />
            <text x="120" y="135" fontFamily="Oswald, Arial, sans-serif" fontSize="48" fontWeight="700" fill="#fff" textAnchor="middle">DC</text>
            <text x="120" y="200" fontFamily="Oswald, Arial, sans-serif" fontSize="14" fontWeight="600" letterSpacing="3" fill="#67B7FF" textAnchor="middle">PARTNERSHIPS</text>
          </svg>
          <div>
            <div className="font-serif text-3xl text-navy mb-2">2026/27 Partnership Brochure</div>
            <p className="text-mute text-sm mb-6 max-w-xs mx-auto">View our full commercial partnership options and sponsorship packages.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => setLoaded(true)}
                className="bg-navy text-paper px-8 py-3.5 font-semibold text-sm tracking-wide uppercase hover:bg-navy-deep transition-colors"
              >
                View brochure
              </button>
              <a
                href="/partnership-brochure.html"
                target="_blank"
                rel="noopener noreferrer"
                className="border border-navy text-navy px-8 py-3.5 font-semibold text-sm tracking-wide uppercase hover:bg-navy/5 transition-colors"
              >
                Open full screen
              </a>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div
            ref={wrapperRef}
            style={{
              width: "100%",
              overflow: "hidden",
              height: scaledHeight ? `${scaledHeight}px` : "100svh",
            }}
          >
            <iframe
              ref={iframeRef}
              src="/partnership-brochure.html"
              title="Doncaster City FC 2026/27 Partnership Brochure"
              scrolling="no"
              style={{ border: "none", display: "block", overflow: "hidden" }}
            />
          </div>
          <div className="text-center py-4 text-xs text-mute">
            <a
              href="/partnership-brochure.html"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-navy"
            >
              Open brochure in full screen
            </a>
          </div>
        </>
      )}
    </>
  );
}
