import {readFile, readdir} from "node:fs/promises";
import {resolve} from "node:path";

export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

function safeLink(value) {
  try {
    const url = new URL(value, "https://shaiolssss.github.io/shaiol/");
    return ["https:", "http:"].includes(url.protocol) ? escapeHTML(url.href) : null;
  } catch { return null; }
}

// Escape raw HTML so a journal entry cannot inject scripts into the site.
function inline(value) {
  const tokens = /(`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+\)|\*\*[^*\n]+\*\*)/g;
  let result = "", start = 0;
  for (const match of value.matchAll(tokens)) {
    result += escapeHTML(value.slice(start, match.index));
    const token = match[0];
    if (token.startsWith("`")) result += "<code>" + escapeHTML(token.slice(1, -1)) + "</code>";
    else if (token.startsWith("**")) result += "<strong>" + escapeHTML(token.slice(2, -2)) + "</strong>";
    else {
      const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      const url = safeLink(link[2]);
      result += url ? '<a href="' + url + '">' + escapeHTML(link[1]) + "</a>" : escapeHTML(token);
    }
    start = match.index + token.length;
  }
  return result + escapeHTML(value.slice(start));
}

export function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let paragraph = [], list = [], listType = "", code = null, quotes = [];
  const flushParagraph = () => { if (paragraph.length) blocks.push("<p>" + inline(paragraph.join(" ")) + "</p>"); paragraph = []; };
  const flushList = () => { if (list.length) blocks.push("<" + listType + ">" + list.map(item => "<li>" + inline(item) + "</li>").join("") + "</" + listType + ">"); list = []; listType = ""; };
  const flushQuotes = () => { if (quotes.length) blocks.push("<blockquote><p>" + inline(quotes.join(" ")) + "</p></blockquote>"); quotes = []; };
  const flush = () => { flushParagraph(); flushList(); flushQuotes(); };
  for (const line of lines) {
    if (code !== null) {
      if (/^```/.test(line)) { blocks.push("<pre><code>" + escapeHTML(code.join("\n")) + "</code></pre>"); code = null; }
      else code.push(line);
      continue;
    }
    if (/^```/.test(line)) { flush(); code = []; continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { flush(); const level = Math.max(2, heading[1].length); blocks.push("<h" + level + ">" + inline(heading[2]) + "</h" + level + ">"); continue; }
    const item = line.match(/^\s*(?:[-*+]\s+|(\d+)[.)]\s+)(.+)$/);
    if (item) { flushParagraph(); flushQuotes(); const type = item[1] ? "ol" : "ul"; if (listType && listType !== type) flushList(); listType = type; list.push(item[2]); continue; }
    if (/^>\s?/.test(line)) { flushParagraph(); flushList(); quotes.push(line.replace(/^>\s?/, "")); continue; }
    flushList(); flushQuotes(); paragraph.push(line.trim());
  }
  flush();
  if (code !== null) blocks.push("<pre><code>" + escapeHTML(code.join("\n")) + "</code></pre>");
  return blocks.join("\n");
}

export async function readJournal(root) {
  const entries = [];
  async function walk(directory, parts = []) {
    let children;
    try { children = await readdir(directory, {withFileTypes:true}); }
    catch (error) { if (error.code === "ENOENT") return; throw error; }
    for (const item of children) {
      if (item.isDirectory()) { await walk(resolve(directory, item.name), [...parts, item.name]); continue; }
      if (!item.isFile() || !/^\d{4}-\d{2}-\d{2}\.md$/.test(item.name)) continue;
      const date = item.name.slice(0, -3), source = [...parts, item.name].join("/");
      if (source !== date.slice(0,4) + "/" + date.slice(5,7) + "/" + date + ".md" || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Invalid journal date/path: " + source);
      const markdown = await readFile(resolve(directory, item.name), "utf8");
      const title = markdown.match(/^#\s+(.+)$/m)?.[1] || date + " 开发与学习日志";
      const body = markdown.replace(/^#\s+.+(?:\r?\n|$)/m, "");
      const summary = body.split(/\r?\n/).find(line => line.trim() && !/^\s*[#>*-]/.test(line))?.trim() || "开发与学习记录。";
      entries.push({date, title, summary, source:"logs/" + source, body});
    }
  }
  await walk(resolve(root, "logs"));
  return entries.sort((a,b) => b.date.localeCompare(a.date));
}

export function journalIndex(entries, href) {
  return '<main id="main" class="inner-page journal-archive"><a class="backlink" href="' + href("") + '">← 返回首页</a><header class="page-heading"><span class="eyebrow">DAILY / DEVELOPMENT &amp; LEARNING</span><h1>Journal<span>工作日志</span></h1><p>Shaiol 的开发与学习记录，按日期整理。</p></header><div class="journal-meta"><span>' + entries.length + ' 篇记录</span><span>北京时间 · Asia/Shanghai</span></div><div class="journal-list">' + entries.map(entry => '<a class="journal-row" href="' + href("logs/" + entry.date) + '"><time datetime="' + entry.date + '">' + entry.date.replaceAll("-", ".") + '</time><div><h2>' + escapeHTML(entry.title.replace(/^\d{4}-\d{2}-\d{2}\s*/, "")) + '</h2><p>' + escapeHTML(entry.summary) + '</p></div><span aria-hidden="true">↗</span></a>').join("") + '</div></main>';
}

export function journalEntry(entry, index, entries, href) {
  const source = "https://github.com/ShaiolSSSS/shaiol/blob/main/" + entry.source;
  const previous = entries[index + 1], next = entries[index - 1];
  return '<main id="main" class="inner-page article-page journal-entry"><a class="backlink" href="' + href("logs") + '">← 全部日志</a><header class="page-heading"><span class="eyebrow">DAILY JOURNAL / <time datetime="' + entry.date + '">' + entry.date.replaceAll("-", ".") + '</time></span><h1 class="article-title">开发与学习日志</h1><p>Shaiol · 北京时间</p></header><article class="document-copy journal-copy">' + renderMarkdown(entry.body) + '</article><nav class="journal-pagination" aria-label="日志导航"><div>' + (previous ? '<a href="' + href("logs/" + previous.date) + '">← ' + previous.date + '</a>' : "") + '</div><a href="' + href("logs") + '">全部日志</a><div>' + (next ? '<a href="' + href("logs/" + next.date) + '">' + next.date + ' →</a>' : "") + '</div></nav><p class="journal-source"><a href="' + source + '">查看原始记录 ↗</a></p></main>';
}
