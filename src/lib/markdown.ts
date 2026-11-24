// A tiny Markdown renderer for the cloud AI's answer. It covers what Gemini
// writes (headings, bold, italic, inline code, bullet and numbered lists, line
// breaks) and nothing more. Model text is never turned into HTML: it is parsed
// into blocks, and React renders every piece as a text node, so a "<script>" in
// the answer shows up as the characters "<script>".
import React, { type ReactNode } from "react";

export type Inline = { text: string; bold?: boolean; italic?: boolean; code?: boolean };
export type Block =
  | { kind: "heading"; level: number; content: Inline[] }
  | { kind: "list"; ordered: boolean; items: Inline[][] }
  | { kind: "paragraph"; lines: Inline[][] };

// **bold**, __bold__, *italic*, _italic_, `code`. Unclosed markers stay as text.
const INLINE = /(\*\*|__)(.+?)\1|`([^`]+)`|(?<![\w*])([*_])(?!\s)(.+?)(?<!\s)\4(?![\w*])/g;

export const parseInline = (s: string): Inline[] => {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index > last) out.push({ text: s.slice(last, m.index) });
    if (m[2] !== undefined) out.push(...parseInline(m[2]).map((p) => ({ ...p, bold: true })));
    else if (m[3] !== undefined) out.push({ text: m[3], code: true });
    else out.push(...parseInline(m[5]).map((p) => ({ ...p, italic: true })));
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ text: s.slice(last) });
  return out;
};

const HEADING = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.*)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export const parseMarkdown = (text: string): Block[] => {
  const blocks: Block[] = [];
  let para: Inline[][] | null = null;
  let list: Extract<Block, { kind: "list" }> | null = null;
  const close = () => {
    para = null;
    list = null;
  };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      close();
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      close();
      blocks.push({ kind: "heading", level: h[1].length, content: parseInline(h[2]) });
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    if (b || n) {
      const ordered = !!n;
      if (!list || list.ordered !== ordered) {
        para = null;
        list = { kind: "list", ordered, items: [] };
        blocks.push(list);
      }
      list.items.push(parseInline((b ?? n)![1]));
      continue;
    }
    if (!para) {
      list = null;
      para = [];
      blocks.push({ kind: "paragraph", lines: para });
    }
    para.push(parseInline(line.trim()));
  }
  return blocks;
};

const h = React.createElement;

const inline = (parts: Inline[]): ReactNode[] =>
  parts.map((p, i) => {
    if (p.code) return h("code", { key: i, className: "rounded bg-surface-2 px-1 font-mono text-[12px]" }, p.text);
    let node: ReactNode = p.text;
    if (p.italic) node = h("em", null, node);
    if (p.bold) node = h("strong", { className: "font-semibold text-ink" }, node);
    return h(React.Fragment, { key: i }, node);
  });

const HEADING_CLASS = "mt-4 font-mono text-[14px] font-semibold tracking-[-0.01em] text-ink first:mt-0";

// Blocks to React elements. Only text nodes carry model text.
export const renderMarkdown = (text: string): ReactNode[] =>
  parseMarkdown(text).map((b, i) => {
    if (b.kind === "heading") {
      const tag = `h${Math.min(b.level + 3, 6)}`; // the panel title is an h3
      return h(tag, { key: i, className: b.level === 1 ? `${HEADING_CLASS} text-[16px]` : HEADING_CLASS }, ...inline(b.content));
    }
    if (b.kind === "list")
      return h(
        b.ordered ? "ol" : "ul",
        { key: i, className: `mt-2 space-y-1 pl-5 first:mt-0 ${b.ordered ? "list-decimal" : "list-disc"}` },
        ...b.items.map((it, j) => h("li", { key: j }, ...inline(it))),
      );
    return h(
      "p",
      { key: i, className: "mt-2 first:mt-0" },
      ...b.lines.flatMap((l, j) => (j === 0 ? inline(l) : [h("br", { key: `br${j}` }), ...inline(l)])),
    );
  });
