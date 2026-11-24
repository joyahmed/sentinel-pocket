// The cloud answer's Markdown is rendered, and model text never becomes HTML.
import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseMarkdown, renderMarkdown } from "../src/lib/markdown.ts";
import { sendStateText } from "../src/lib/triage.ts";

const html = (md: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, ...renderMarkdown(md)));

test("bold becomes <strong>, not asterisks", () => {
  const out = html("The **root** account changed.");
  assert.match(out, /<p[^>]*>The <strong[^>]*>root<\/strong> account changed\.<\/p>/);
  assert.doesNotMatch(out, /\*\*/);
});

test("### becomes a heading, not hash marks", () => {
  const out = html("### What happened\nA miner started.");
  assert.match(out, /<h6[^>]*>What happened<\/h6>/);
  assert.match(out, /<p[^>]*>A miner started\.<\/p>/);
  assert.doesNotMatch(out, /#/);
});

test("bullet and numbered lists become <ul>/<ol>", () => {
  const out = html("- one\n* two with **bold**\n\n1. first\n2. second");
  assert.match(out, /<ul[^>]*><li>one<\/li><li>two with <strong[^>]*>bold<\/strong><\/li><\/ul>/);
  assert.match(out, /<ol[^>]*><li>first<\/li><li>second<\/li><\/ol>/);
});

test("single line breaks inside a paragraph are kept", () => {
  assert.match(html("line one\nline two"), /line one<br\/>line two/);
});

test("<script> in model text comes out as text, never as a tag", () => {
  const out = html('## <script>alert(1)</script>\nSee <img src=x onerror="alert(2)"> and **<b>x</b>**\n- <a href="javascript:1">y</a>');
  assert.doesNotMatch(out, /<script/i);
  assert.doesNotMatch(out, /<img/i);
  assert.doesNotMatch(out, /<a /i);
  assert.doesNotMatch(out, /<b>/);
  assert.match(out, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(out, /&lt;img src=x onerror=&quot;alert\(2\)&quot;&gt;/);
});

test("unclosed markers stay as plain text", () => {
  assert.deepEqual(parseMarkdown("2 * 3 and **open"), [
    { kind: "paragraph", lines: [[{ text: "2 * 3 and **open" }]] },
  ]);
});

test("send line: before, during and after a send", () => {
  assert.equal(sendStateText(false, null), "Nothing has been sent yet.");
  assert.equal(sendStateText(true, new Date(2026, 10, 24, 9, 5)), "Sent to the cloud AI. Waiting for its answer…");
  assert.equal(sendStateText(false, new Date(2026, 10, 24, 9, 5)), "Sent at 09:05.");
});
