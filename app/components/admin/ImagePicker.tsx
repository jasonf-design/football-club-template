import { useRef, useState } from "react";

export function ImagePicker({
  name,
  initialUrl,
  initialMediaId,
  label = "Image",
  aspect = "aspect-square",
}: {
  name: string;
  initialUrl?: string | null;
  initialMediaId?: string | null;
  label?: string;
  aspect?: string;
}) {
  const [preview, setPreview] = useState<string | null>(initialUrl ?? null);
  const [mediaId, setMediaId] = useState<string>(initialMediaId ?? "");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/api/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { id: string; url: string };
      setPreview(data.url);
      setMediaId(data.id);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.24em] text-mute mb-1.5">
        {label}
      </div>
      <div
        className={`relative ${aspect} max-w-xs bg-paper border border-line overflow-hidden group`}
      >
        {preview ? (
          <img
            src={preview}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-mute">
            No image
          </div>
        )}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="absolute inset-0 bg-navy/0 hover:bg-navy/40 transition-colors flex items-end justify-center pb-3"
        >
          <span className="px-3 py-1.5 bg-paper text-navy text-[10px] uppercase tracking-[0.2em] opacity-0 group-hover:opacity-100 transition-opacity">
            {uploading ? "Uploading…" : preview ? "Replace" : "Upload"}
          </span>
        </button>
      </div>
      {preview && (
        <button
          type="button"
          onClick={() => {
            setPreview(null);
            setMediaId("");
          }}
          className="mt-2 text-xs text-mute hover:text-red"
        >
          Remove image
        </button>
      )}
      {error && <div className="mt-2 text-xs text-red">{error}</div>}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.target.value = "";
        }}
      />
      <input type="hidden" name={name} value={mediaId} />
    </div>
  );
}
