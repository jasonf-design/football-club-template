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

    const applyScale = () => {
      try {
        const doc = iframe.contentDocument?.documentElement;
        if (!doc) return;
        const contentW = doc.scrollWidth;
        const contentH = doc.scrollHeight;
        if (contentW < 100 || contentH < 100) return;

        const wrapperW = wrapper.clientWidth;
        const scale = Math.min(1, wrapperW / contentW);

        iframe.style.width = `${contentW}px`;
        iframe.style.height = `${contentH}px`;
        iframe.style.transform = scale < 1 ? `scale(${scale})` : "";
        iframe.style.transformOrigin = "top left";
        setScaledHeight(contentH * scale);
      } catch {
        // cross-origin guard
      }
    };

    const onLoad = () => {
      // Poll until content settles then apply scale
      let stable = 0;
      let lastH = 0;
      const poll = () => {
        try {
          const h = iframe.contentDocument?.documentElement?.scrollHeight ?? 0;
          if (h === lastH) stable++;
          else { stable = 0; lastH = h; }
          if (stable >= 3) { applyScale(); return; }
          timer = setTimeout(poll, 300);
        } catch { applyScale(); }
      };
      timer = setTimeout(poll, 200);
    };

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
        style={{ width: "100%", overflow: "hidden", height: scaledHeight ?? "100vh" }}
      >
        <iframe
          ref={iframeRef}
          src="/partnership-brochure.html"
          title="Doncaster City FC 2026/27 Partnership Brochure"
          style={{ border: "none", display: "block" }}
        />
      </div>
    </>
  );
}
