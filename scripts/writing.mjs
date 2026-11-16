import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { renderMarkdown } from "./journal.mjs";

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
    const date = file.name.slice(0, -3);
    const parsedDate = new Date(date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || Number.isNaN(+parsedDate) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error("Invalid writing filename: " + file.name);
    }
    const body = (await readFile(resolve(directory, file.name), "utf8")).trim();
    if (!body) throw new Error("Missing writing body: " + file.name);
    entries.push({ date, body });
  }
  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

function dateLabel(date) {
  return '<time datetime="' + date + '">' + date.replaceAll("-", ".") + '</time>';
}

export function writingIndex(entries, href) {
  const rows = entries.map(entry => '<a class="journal-row" href="' + href("notes/" + entry.date) + '">' +
    dateLabel(entry.date) + '<span aria-hidden="true">↗</span></a>');
  return '<main id="main" class="inner-page writing-page journal-archive">' +
    '<header class="page-heading"><h1>Writing<span>随笔</span></h1><p>随笔与闲谈。</p></header>' +
    '<section class="journal-list" aria-label="随笔列表">' + rows.join("") + '</section></main>';
}

export function writingEntry(entry, href, prefix) {
  const imageBase = prefix + "assets/writing/" + entry.date + "/";
  return '<main id="main" class="inner-page article-page journal-entry">' +
    '<a class="backlink" href="' + href("notes") + '">← 全部随笔</a>' +
    '<header class="page-heading"><h1 class="article-title">' + dateLabel(entry.date) + '</h1></header>' +
    '<article class="document-copy journal-copy writing-copy">' +
    renderMarkdown(entry.body, { imageBase }) + '</article></main>';
}
