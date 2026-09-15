import { marked } from "marked";

export function Markdown({ content, className = "" }: { content: string; className?: string }) {
  const html = marked.parse(content, { async: false }) as string;
  return (
    <div
      className={`sdx-prose ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
