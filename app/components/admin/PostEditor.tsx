import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import Typography from "@tiptap/extension-typography";
import { useEffect, useRef, useState } from "react";

const TIP = {
  bold: "Bold (⌘B)",
  italic: "Italic (⌘I)",
  h2: "Heading",
  h3: "Subheading",
  bullet: "Bulleted list",
  ordered: "Numbered list",
  quote: "Blockquote",
  hr: "Horizontal rule",
  link: "Add link",
  image: "Insert image",
  undo: "Undo",
  redo: "Redo",
};

export function PostEditor({
  initialHtml,
  initialJson,
  htmlFieldName = "bodyHtml",
  jsonFieldName = "bodyJson",
  placeholder = "Tell the story…",
}: {
  initialHtml?: string;
  initialJson?: unknown;
  htmlFieldName?: string;
  jsonFieldName?: string;
  placeholder?: string;
}) {
  const [html, setHtml] = useState(initialHtml ?? "");
  const [json, setJson] = useState<string>(
    initialJson ? JSON.stringify(initialJson) : "",
  );
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-sky-bright underline underline-offset-4" },
      }),
      Image.configure({
        HTMLAttributes: { class: "my-6 w-full h-auto" },
      }),
      Placeholder.configure({ placeholder }),
      Typography,
    ],
    content: initialJson ?? initialHtml ?? "",
    editorProps: {
      attributes: {
        class:
          "prose-content min-h-[400px] focus:outline-none px-6 py-6 font-serif text-lg leading-relaxed text-ink",
      },
    },
    onUpdate: ({ editor }) => {
      setHtml(editor.getHTML());
      setJson(JSON.stringify(editor.getJSON()));
    },
    immediatelyRender: false,
  });

  useEffect(() => () => editor?.destroy(), [editor]);

  async function handleImageUpload(file: File) {
    if (!editor) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/admin/api/upload", {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      const data = (await res.json()) as { url: string };
      editor.chain().focus().setImage({ src: data.url }).run();
    } finally {
      setUploading(false);
    }
  }

  if (!editor) return null;

  return (
    <div className="bg-paper border border-line">
      <Toolbar editor={editor} onPickImage={() => fileInputRef.current?.click()} uploading={uploading} />
      <EditorContent editor={editor} />
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImageUpload(f);
          e.target.value = "";
        }}
      />
      <input type="hidden" name={htmlFieldName} value={html} />
      <input type="hidden" name={jsonFieldName} value={json} />
    </div>
  );
}

function Toolbar({
  editor,
  onPickImage,
  uploading,
}: {
  editor: Editor;
  onPickImage: () => void;
  uploading: boolean;
}) {
  return (
    <div className="border-b border-line bg-paper-warm/60 px-3 py-2 flex flex-wrap items-center gap-1 sticky top-0 z-10">
      <Btn
        title={TIP.bold}
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <span className="font-bold">B</span>
      </Btn>
      <Btn
        title={TIP.italic}
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </Btn>
      <Divider />
      <Btn
        title={TIP.h2}
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <span className="font-serif font-semibold">H2</span>
      </Btn>
      <Btn
        title={TIP.h3}
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <span className="font-serif font-semibold">H3</span>
      </Btn>
      <Divider />
      <Btn
        title={TIP.bullet}
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        •
      </Btn>
      <Btn
        title={TIP.ordered}
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        1.
      </Btn>
      <Btn
        title={TIP.quote}
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        ❝
      </Btn>
      <Btn
        title={TIP.hr}
        onClick={() => editor.chain().focus().setHorizontalRule().run()}
      >
        —
      </Btn>
      <Divider />
      <Btn
        title={TIP.link}
        active={editor.isActive("link")}
        onClick={() => {
          const existing = editor.getAttributes("link").href as
            | string
            | undefined;
          const url = window.prompt("URL", existing ?? "https://");
          if (url === null) return;
          if (url === "") {
            editor.chain().focus().unsetLink().run();
          } else {
            editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          }
        }}
      >
        ↗
      </Btn>
      <Btn
        title={uploading ? "Uploading…" : TIP.image}
        onClick={onPickImage}
        disabled={uploading}
      >
        {uploading ? "⏳" : "🖼"}
      </Btn>
      <div className="ml-auto flex items-center gap-1">
        <Btn
          title={TIP.undo}
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
        >
          ↺
        </Btn>
        <Btn
          title={TIP.redo}
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
        >
          ↻
        </Btn>
      </div>
    </div>
  );
}

function Btn({
  children,
  title,
  active,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className={[
        "h-8 min-w-[32px] px-2 text-sm flex items-center justify-center transition-colors rounded",
        active
          ? "bg-navy text-paper"
          : "text-ink hover:bg-line/60 disabled:opacity-40 disabled:hover:bg-transparent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="h-5 w-px bg-line mx-1" aria-hidden />;
}
