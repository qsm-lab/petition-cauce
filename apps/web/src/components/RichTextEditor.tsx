"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Heading from "@tiptap/extension-heading";
import Placeholder from "@tiptap/extension-placeholder";

interface Props {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

function ToolbarButton({
  active,
  onClick,
  children,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="px-2 py-1 rounded-[6px] text-[12px] font-semibold transition-colors min-w-[28px] flex items-center justify-center"
      style={{
        background: active ? "var(--bp)" : "transparent",
        color: active ? "var(--bop)" : "var(--bmut)",
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextEditor({ value, onChange, placeholder, minHeight = 200 }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        code: false,
        horizontalRule: false,
      }),
      Heading.configure({ levels: [2, 3] }),
      Placeholder.configure({
        placeholder: placeholder ?? "Escribe aquí…",
      }),
    ],
    content: value || "",
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "petition-rich-editor",
        style: `min-height:${minHeight}px; outline:none; padding:12px; color:var(--bink); font-size:13px; line-height:1.7;`,
      },
    },
  });

  if (!editor) return null;

  return (
    <div>
      {/* Toolbar */}
      <div
        className="flex items-center gap-0.5 px-2 py-1.5 flex-wrap"
        style={{ borderBottom: "1px solid var(--bbord)" }}
      >
        <ToolbarButton
          title="Título (H2)"
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Subtítulo (H3)"
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>

        <div className="w-px h-4 mx-1" style={{ background: "var(--bbord)" }} />

        <ToolbarButton
          title="Negrita"
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Cursiva"
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>i</em>
        </ToolbarButton>
        <ToolbarButton
          title="Tachado"
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        >
          <s>S</s>
        </ToolbarButton>

        <div className="w-px h-4 mx-1" style={{ background: "var(--bbord)" }} />

        <ToolbarButton
          title="Lista con viñetas"
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          ≡
        </ToolbarButton>
        <ToolbarButton
          title="Lista numerada"
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          title="Cita"
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          "
        </ToolbarButton>

        <div className="w-px h-4 mx-1" style={{ background: "var(--bbord)" }} />

        <ToolbarButton
          title="Deshacer"
          active={false}
          onClick={() => editor.chain().focus().undo().run()}
        >
          ↩
        </ToolbarButton>
        <ToolbarButton
          title="Rehacer"
          active={false}
          onClick={() => editor.chain().focus().redo().run()}
        >
          ↪
        </ToolbarButton>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      <style>{`
        .petition-rich-editor h2 {
          font-size: 17px;
          font-weight: 700;
          color: var(--bink);
          margin: 14px 0 6px;
        }
        .petition-rich-editor h3 {
          font-size: 14px;
          font-weight: 700;
          color: var(--bink);
          margin: 10px 0 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .petition-rich-editor ul {
          padding-left: 20px;
          list-style: disc;
          margin: 6px 0;
        }
        .petition-rich-editor ol {
          padding-left: 20px;
          list-style: decimal;
          margin: 6px 0;
        }
        .petition-rich-editor blockquote {
          border-left: 3px solid var(--bp);
          padding-left: 12px;
          margin: 8px 0;
          opacity: 0.8;
          font-style: italic;
        }
        .petition-rich-editor p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: var(--bmut);
          opacity: 0.5;
          float: left;
          pointer-events: none;
          height: 0;
        }
        .petition-rich-editor p + p {
          margin-top: 6px;
        }
      `}</style>
    </div>
  );
}
