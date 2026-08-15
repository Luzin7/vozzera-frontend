import type { ReactNode } from "react";

import { parseBlocks } from "@/lib/vozzera/markdown";
import type { Block, Inline } from "@/lib/vozzera/markdown";

function InlineNodes({ nodes }: { nodes: Inline[] }): ReactNode {
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
          <InlineNodes nodes={node.children} />
        </strong>
      );
    }
    if (node.kind === "italic") {
      return (
        <em key={index}>
          <InlineNodes nodes={node.children} />
        </em>
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
        <InlineNodes nodes={node.children} />
      </a>
    );
  });
}

function BlockNodes({ blocks }: { blocks: Block[] }) {
  return blocks.map((block, index) => {
    if (block.kind === "heading") {
      const Tag = `h${block.level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      return (
        <Tag key={index} className="mt-2 font-semibold leading-snug text-foreground first:mt-0">
          <InlineNodes nodes={block.children} />
        </Tag>
      );
    }

    if (block.kind === "code") {
      return (
        <pre
          key={index}
          className="overflow-x-auto rounded bg-muted p-2 font-mono text-[0.85em] leading-relaxed text-foreground"
        >
          <code>{block.text}</code>
        </pre>
      );
    }

    if (block.kind === "quote") {
      return (
        <blockquote key={index} className="border-l-2 border-border pl-3 text-muted-foreground">
          <InlineNodes nodes={block.children} />
        </blockquote>
      );
    }

    if (block.kind === "list") {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index} className="list-inside list-disc space-y-0.5">
          {block.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <InlineNodes nodes={item} />
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
        <InlineNodes nodes={block.children} />
      </p>
    );
  });
}

export function Markdown({ content }: { content: string }) {
  const blocks = parseBlocks(content);

  if (blocks.length === 0) {
    return <p className="text-sm leading-relaxed text-foreground/90" />;
  }

  return <BlockNodes blocks={blocks} />;
}
