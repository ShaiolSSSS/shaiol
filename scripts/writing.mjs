import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { escapeHTML, renderMarkdown } from "./journal.mjs";

const siteNote = {
  slug: "about-this-space",
  date: "2026-10-10",
  title: "给想法、学习和作品留一个地方",
};

export async function readWriting(root) {
  const directory = resolve(root, "writing");
  let files;
  try {
    files = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }

  const entries = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".md")) continue;
    const slug = file.name.slice(0, -3);
    const date = slug.slice(0, 10);
    const parsedDate = new Date(date);
    if (!/^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)
        || Number.isNaN(+parsedDate) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error("Invalid writing filename: " + file.name);
    }
    const markdown = await readFile(resolve(directory, file.name), "utf8");
    const heading = markdown.match(/^\uFEFF?# +([^\r\n]+)\r?\n/);
    const title = heading?.[1].trim();
    const body = heading ? markdown.slice(heading[0].length).trim() : "";
    if (!title || !body) throw new Error("Missing writing title or body: " + file.name);
    entries.push({ slug, date, title, body });
  }
  return entries;
}

function dateLabel(date) {
  return '<time datetime="' + date + '">' + date.replaceAll("-", ".") + '</time>';
}

export function writingIndex(entries, href) {
  const rows = [...entries, siteNote]
    .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug))
    .map(entry => '<a class="journal-row" href="' + href("notes/" + entry.slug) + '">' +
      dateLabel(entry.date) + '<div><h2>' + escapeHTML(entry.title) +
      '</h2></div><span aria-hidden="true">↗</span></a>');
  return '<main id="main" class="inner-page writing-page journal-archive">' +
    '<header class="page-heading"><h1>Writing<span>随笔</span></h1><p>随笔与闲谈。</p></header>' +
    '<section class="journal-list" aria-label="随笔列表">' + rows.join("") + '</section></main>';
}

export function writingEntry(entry, href) {
  return '<main id="main" class="inner-page article-page journal-entry">' +
    '<a class="backlink" href="' + href("notes") + '">← 全部随笔</a>' +
    '<header class="page-heading"><span class="eyebrow">' + dateLabel(entry.date) +
    '</span><h1 class="article-title">' + escapeHTML(entry.title) + '</h1></header>' +
    '<article class="document-copy journal-copy">' + renderMarkdown(entry.body) + '</article></main>';
}
