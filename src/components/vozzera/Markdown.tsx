import { Check, Copy } from "lucide-react";
import { memo, type ReactNode, useEffect, useState } from "react";

import { parseBlocks } from "@/lib/vozzera/markdown";
import type { Block, Inline } from "@/lib/vozzera/markdown";

function CodeBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;

    const timeoutId = window.setTimeout(() => setCopied(false), 2000);

    return () => window.clearTimeout(timeoutId);
  }, [copied]);

  function copyCode() {
    void navigator.clipboard.writeText(text).then(
      () => setCopied(true),
      () => setCopied(false),
    );
  }

  const label = copied ? "Código copiado" : "Copiar código";
  const Icon = copied ? Check : Copy;

  return (
    <pre className="relative overflow-x-auto rounded bg-muted p-2 pr-10 font-mono text-[0.85em] leading-relaxed text-foreground">
      <button
        type="button"
        onClick={copyCode}
        aria-label={label}
        title={label}
        className="absolute right-2 top-2 rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Icon className="size-4" aria-hidden="true" />
      </button>
      <code>{text}</code>
    </pre>
  );
}

function InlineNodes({
  nodes,
  onRoomClick,
}: {
  nodes: Inline[];
  onRoomClick: ((roomName: string) => void) | undefined;
}): ReactNode {
  return nodes.map((node, index) => {
    if (node.kind === "text") return node.text;
    if (node.kind === "code") {
      return (
        <code
          key={index}
          className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em] text-foreground"
        >
          {node.text}
        </code>
      );
    }
    if (node.kind === "bold") {
      return (
        <strong key={index} className="font-semibold text-foreground">
          <InlineNodes nodes={node.children} onRoomClick={onRoomClick} />
        </strong>
      );
    }
    if (node.kind === "italic") {
      return (
        <em key={index}>
          <InlineNodes nodes={node.children} onRoomClick={onRoomClick} />
        </em>
      );
    }
    if (node.kind === "room") {
      return (
        <button
          key={index}
          type="button"
          onClick={() => onRoomClick?.(node.roomName)}
          className="text-primary underline underline-offset-2 hover:no-underline"
        >
          #{node.roomName}
        </button>
      );
    }
    return (
      <a
        key={index}
        href={node.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline underline-offset-2"
      >
        <InlineNodes nodes={node.children} onRoomClick={onRoomClick} />
      </a>
    );
  });
}

function BlockNodes({
  blocks,
  onRoomClick,
}: {
  blocks: Block[];
  onRoomClick: ((roomName: string) => void) | undefined;
}) {
  return blocks.map((block, index) => {
    if (block.kind === "heading") {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag key={index} className="mt-2 font-semibold leading-snug text-foreground first:mt-0">
          <InlineNodes nodes={block.children} onRoomClick={onRoomClick} />
        </Tag>
      );
    }

    if (block.kind === "code") {
      return <CodeBlock key={index} text={block.text} />;
    }

    if (block.kind === "quote") {
      return (
        <blockquote key={index} className="border-l-2 border-border pl-3 text-muted-foreground">
          <InlineNodes nodes={block.children} onRoomClick={onRoomClick} />
        </blockquote>
      );
    }

    if (block.kind === "list") {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index} className="list-inside list-disc space-y-0.5">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineNodes nodes={item} onRoomClick={onRoomClick} />
            </li>
          ))}
        </Tag>
      );
    }

    return (
      <p
        key={index}
        className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90"
      >
        <InlineNodes nodes={block.children} onRoomClick={onRoomClick} />
      </p>
    );
  });
}

export const Markdown = memo(function Markdown({
  content,
  onRoomClick,
}: {
  content: string;
  onRoomClick: ((roomName: string) => void) | undefined;
}) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) {
    return <p className="text-sm leading-relaxed text-foreground/90" />;
  }

  return <BlockNodes blocks={blocks} onRoomClick={onRoomClick} />;
});
