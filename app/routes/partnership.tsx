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

  useEffect(() => {
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
        // Always scale to fill the full wrapper width — never leave blank space.
        const scale = wrapperW / contentW;

        iframe.style.width = `${contentW}px`;
        iframe.style.height = `${contentH}px`;
        iframe.style.transform = `scale(${scale})`;
        iframe.style.transformOrigin = "top left";
        setScaledHeight(Math.ceil(contentH * scale));
      } catch {
        // cross-origin guard (shouldn't happen — same origin)
      }
    };

    // Poll for up to 20s after load. The brochure HTML decodes 4MB of
    // base64 assets asynchronously, so scrollHeight stabilises well after
    // the iframe "load" event fires. Re-apply scale whenever height changes.
    const startPolling = () => {
      let ticks = 0;
      const MAX_TICKS = 40; // 20 s at 500 ms intervals

      const poll = () => {
        if (ticks++ >= MAX_TICKS) return;
        try {
          const h =
            iframe.contentDocument?.documentElement?.scrollHeight ?? 0;
          if (h > 100 && h !== lastH) {
            lastH = h;
            applyScale();
          }
        } catch {
          /* cross-origin */
        }
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
      {/* Fallback link for when the brochure is still loading on slow connections */}
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
  );
}
