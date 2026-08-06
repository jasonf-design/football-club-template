import { useState, useRef, useEffect } from "react";
import { variantUrl } from "~/lib/uploads";

export type MediaItem = {
  id: string;
  filename: string;
  originalName: string | null;
  width: number | null;
  height: number | null;
};

export function MediaPickerField({
  name,
  value,
  media: mediaProp,
  label,
  onUpload,
}: {
  name: string;
  value: string;
  media?: MediaItem[];
  label?: string;
  onUpload?: (item: MediaItem) => void;
}) {
  const [selectedId, setSelectedId] = useState(value);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [additions, setAdditions] = useState<MediaItem[]>([]);
  const [loadedMedia, setLoadedMedia] = useState<MediaItem[] | null>(mediaProp ?? null);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const allMedia = [...additions, ...(loadedMedia ?? [])];
  const selected = allMedia.find((m) => m.id === selectedId);

  const filtered = search.trim()
    ? allMedia.filter((m) => {
        const n = (m.originalName ?? m.filename).toLowerCase();
        return n.includes(search.toLowerCase());
      })
    : allMedia;

  async function openModal() {
    setOpen(true);
    if (!loadedMedia) {
      setLoading(true);
      try {
        const res = await fetch("/admin/api/media");
        if (res.ok) setLoadedMedia(await res.json() as MediaItem[]);
      } finally {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  async function handleUpload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/api/upload", { method: "POST", body: fd });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setUploadError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { id: string; filename: string; width: number | null; height: number | null };
      const newItem: MediaItem = { id: data.id, filename: data.filename, originalName: file.name, width: data.width ?? null, height: data.height ?? null };
      setAdditions((prev) => [newItem, ...prev]);
      setSelectedId(data.id);
      onUpload?.(newItem);
      setOpen(false);
    } finally {
      setUploading(false);
    }
  }

  return (
    <>
      {label && (
        <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-1.5">{label}</div>
      )}
      <input type="hidden" name={name} value={selectedId} />

      <button
        type="button"
        onClick={openModal}
        className="w-full flex items-center gap-3 border border-line bg-paper hover:border-navy/40 px-3 py-2 text-left transition-colors"
      >
        {selected ? (
          <>
            <img
              src={variantUrl(selected.filename, 120, "avif")}
              alt=""
              className="h-12 w-12 object-cover flex-shrink-0 bg-paper-warm"
            />
            <div className="min-w-0">
              <div className="text-sm text-ink truncate">
                {selected.originalName ?? selected.filename}
              </div>
              {selected.width && selected.height && (
                <div className="text-xs text-mute">{selected.width}×{selected.height}</div>
              )}
            </div>
            <span className="ml-auto text-[10px] uppercase tracking-widest text-mute flex-shrink-0">Change</span>
          </>
        ) : (
          <span className="text-sm text-mute">— None selected — click to pick</span>
        )}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-navy/60 flex items-start justify-center pt-12 pb-8 px-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-paper w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
            <div className="flex items-center gap-3 px-5 py-4 border-b border-line">
              <div className="text-[10px] uppercase tracking-[0.24em] text-mute">Pick image</div>
              <input
                ref={searchRef}
                type="text"
                placeholder="Search by name…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 bg-paper-warm border border-line px-3 py-1.5 text-sm outline-none focus:border-navy"
              />
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 bg-navy text-white text-[10px] uppercase tracking-widest font-semibold hover:bg-navy/80 disabled:opacity-50 transition-colors"
                >
                  {uploading ? "Uploading…" : "Upload new"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-mute hover:text-ink text-lg leading-none px-1"
                >
                  ✕
                </button>
              </div>
            </div>

            {uploadError && (
              <div className="px-5 py-2 text-xs text-red border-b border-line bg-red/5">
                {uploadError}
              </div>
            )}

            {selectedId && (
              <div className="px-5 py-2 border-b border-line">
                <button
                  type="button"
                  onClick={() => { setSelectedId(""); setOpen(false); }}
                  className="text-xs text-mute hover:text-red"
                >
                  Remove image selection
                </button>
              </div>
            )}

            <div className="overflow-y-auto flex-1 p-4">
              {loading ? (
                <div className="text-center text-mute text-sm py-12">Loading…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center text-mute text-sm py-12">
                  {search ? "No images match that search." : "No images yet — upload one above."}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {filtered.map((m) => {
                    const isSelected = m.id === selectedId;
                    const displayName = m.originalName ?? m.filename;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => { setSelectedId(m.id); setOpen(false); }}
                        className={[
                          "group text-left overflow-hidden border-2 transition-colors",
                          isSelected ? "border-navy" : "border-transparent hover:border-navy/40",
                        ].join(" ")}
                      >
                        <div className="aspect-square bg-paper-warm overflow-hidden relative">
                          <img
                            src={variantUrl(m.filename, 240, "avif")}
                            alt=""
                            className="absolute inset-0 h-full w-full object-cover"
                          />
                          {isSelected && (
                            <div className="absolute inset-0 bg-navy/30 flex items-center justify-center">
                              <div className="w-6 h-6 rounded-full bg-navy text-white text-xs flex items-center justify-center font-bold">✓</div>
                            </div>
                          )}
                        </div>
                        <div className="px-1.5 py-1.5 bg-paper">
                          <div className="text-[11px] text-ink truncate" title={displayName}>
                            {displayName}
                          </div>
                          {m.width && m.height && (
                            <div className="text-[10px] text-mute">{m.width}×{m.height}</div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
