import {readFile,readdir,stat} from "node:fs/promises";import {resolve} from "node:path";
const root=resolve(import.meta.dirname,"../dist"),base="/shaiol/";
const removed=["把创作中的思考","慢慢整理成文字","正在把脑海里的想法","变成能被体验的作品","想法、故事，","还有正在发生的创作"];
let pages=0,links=0;
async function walk(dir){for(const name of await readdir(dir)){const file=resolve(dir,name);if((await stat(file)).isDirectory()){await walk(file);continue;}if(!name.endsWith(".html"))continue;pages++;const html=await readFile(file,"utf8");for(const text of removed)if(html.includes(text))throw new Error("Removed text remains: "+text);for(const m of html.matchAll(/(?:href|src)="([^"]+)"/g)){if(!m[1].startsWith("/"))continue;if(!m[1].startsWith(base))throw new Error("Bad base: "+m[1]);const path=m[1].split("#")[0].slice(base.length);const target=resolve(root,path);const details=await stat(target);if(details.isDirectory())await stat(resolve(target,"index.html"));links++;}}
}await walk(root);console.log("Checked "+pages+" HTML pages and "+links+" local links/assets.");
