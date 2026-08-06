import { useCallback, useRef, useState } from "react";

interface Props {
  mediaId: string;
  src: string;
  initialX?: number;
  initialY?: number;
  onClose: () => void;
}

export function FocalPointPicker({ mediaId, src, initialX = 0.5, initialY = 0.5, onClose }: Props) {
  const [focal, setFocal] = useState({ x: initialX, y: initialY });
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const imgRef = useRef<HTMLImageElement>(null);

  const handleClick = useCallback(async (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    setFocal({ x, y });
    setStatus("saving");
    try {
      await fetch("/admin/api/focal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: mediaId, focalX: x, focalY: y }),
      });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 1500);
    } catch {
      setStatus("idle");
    }
  }, [mediaId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div
        className="relative bg-paper shadow-2xl flex flex-col"
        style={{ maxWidth: "min(90vw, 680px)", maxHeight: "90vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
          <div>
            <div className="font-medium text-navy text-sm">Set focal point</div>
            <div className="text-xs text-mute mt-0.5">Click the most important part of the image</div>
          </div>
          <div className="flex items-center gap-3">
            <span className={`text-xs font-medium transition-opacity ${status === "saved" ? "text-emerald-600 opacity-100" : "opacity-0"}`}>
              Saved ✓
            </span>
            <button onClick={onClose} className="text-mute hover:text-ink text-xl leading-none px-1">×</button>
          </div>
        </div>

        {/* Image + click target */}
        <div className="overflow-auto flex-1 flex items-center justify-center p-4 bg-paper-warm/50">
          <div
            className="relative cursor-crosshair select-none"
            onClick={handleClick}
          >
            <img
              ref={imgRef}
              src={src}
              alt=""
              className="block max-w-full max-h-[60vh] object-contain"
              draggable={false}
            />
            {/* Crosshair marker */}
            <div
              className="absolute pointer-events-none"
              style={{
                left: `${focal.x * 100}%`,
                top: `${focal.y * 100}%`,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div className="w-5 h-5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)] bg-white/20" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-px h-5 bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.4)]" style={{ position: "absolute" }} />
                <div className="h-px w-5 bg-white shadow-[0_0_0_0.5px_rgba(0,0,0,0.4)]" style={{ position: "absolute" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <div className="shrink-0 px-4 py-2.5 border-t border-line text-xs text-mute">
          Focal point: {Math.round(focal.x * 100)}% across, {Math.round(focal.y * 100)}% down · {status === "saving" ? "Saving…" : "Changes save instantly"}
        </div>
      </div>
    </div>
  );
}
