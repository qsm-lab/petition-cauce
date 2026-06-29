import React from "react";

const TOKEN_RE = /(\*\*[^*]+\*\*|==(?:[^=]|=[^=])+==|\*[^*]+\*)/;

function parseMarkdown(text: string): React.ReactNode[] {
  return text.split(TOKEN_RE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("==") && part.endsWith("==")) {
      return (
        <mark key={i} className="bg-yellow-400/20 text-yellow-200 rounded px-0.5 not-italic">
          {part.slice(2, -2)}
        </mark>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i}>{part.slice(1, -1)}</em>;
    }
    return part || null;
  });
}

interface Props {
  children: string;
}

export default function MarkdownText({ children }: Props) {
  return <>{parseMarkdown(children)}</>;
}
