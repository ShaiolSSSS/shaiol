import {readFile,mkdir,writeFile,cp} from "node:fs/promises";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {readJournal,journalIndex,journalEntry,escapeHTML} from "./journal.mjs";
const root=resolve(import.meta.dirname,"..");
const assets=await Promise.all(["site.css","site.js","effects.js"].map(name=>readFile(resolve(root,"public/assets",name),"utf8")));
const assetVersion=createHash("sha256").update(assets.join("\n")).digest("hex").slice(0,12);
const base="/"+(process.env.BASE_PATH||"/shaiol").replace(/^\/+|\/+$/g,"");
const prefix=base==="/"?"/":base+"/";
const site="https://shaiolssss.github.io"+prefix;
const pages=[{path:"",source:"home",title:"Shaiol",nav:"home"},{path:"works",source:"works",title:"作品 · Shaiol",nav:"works"},{path:"about",source:"about",title:"关于 · Shaiol",nav:"about"},{path:"projects/channel2000",source:"channel2000",title:"千禧频道 · Shaiol",nav:"works"},{path:"notes/about-this-space",source:"about-this-space",title:"给想法、学习和作品留一个地方 · Shaiol",nav:"home"}];
const links=[["","Home","首页","home"],["works","Works","作品","works"],["about","About","关于","about"]];
const mark='<span class="wordmark">Shaiol<span class="wordmark-dot">.</span></span>';
const href=p=>prefix+(p?p+"/":"");
function header(current){return '<a class="skip-link" href="#main">跳到正文</a><div class="grid-background" aria-hidden="true"></div><header class="site-header"><a class="monogram" href="'+prefix+'" aria-label="Shaiol 首页">S<span>✦</span></a><nav class="primary-nav" aria-label="主导航">'+links.map(([p,en,zh,id])=>'<a href="'+href(p)+'"'+(current===id?' class="active" aria-current="page"':'')+'>'+en+'<span>'+zh+'</span></a>').join("")+'</nav><button class="menu-toggle" aria-label="打开菜单" aria-expanded="false" aria-controls="site-menu"><span></span><span></span></button></header>';}
const menu='<dialog id="site-menu" class="menu-dialog" aria-label="网站菜单"><button class="menu-close" aria-label="关闭菜单">×</button><div class="menu-identity">'+mark+'<p>IDEAS, STORIES &amp; PLAY.</p></div><nav aria-label="页面导航">'+links.map(([p,en,zh],i)=>'<a href="'+href(p)+'"><small>0'+(i+1)+'</small><b>'+en+'</b><span>'+zh+'</span><i aria-hidden="true">↗</i></a>').join("")+'</nav><p class="menu-copyright">© 2026 SHAIOL</p></dialog>';
const gate='<div class="secret-gate"><form id="secret-entry" class="secret-entry" autocomplete="on" aria-hidden="true" inert><input id="secret-code" name="password" type="password" aria-label="通行口令" aria-describedby="gate-message" autocomplete="current-password" autocapitalize="off" spellcheck="false" enterkeyhint="go" required maxlength="128" placeholder="私たちのスローガンは……"><button class="unlock" type="submit" aria-label="打开星门">↗</button></form><p id="gate-message" role="status" class="gate-message"></p><button class="secretstar" type="button" aria-label="星星" aria-expanded="false" aria-controls="secret-entry"><span aria-hidden="true">✦</span></button></div>';
const footer='<footer class="site-footer"><div class="footer-top"><a href="'+prefix+'" aria-label="Shaiol 首页">'+mark+'</a></div><div class="footer-bottom"><span>© 2026 SHAIOL</span><nav aria-label="页脚导航">'+links.map(([p,,zh])=>'<a href="'+href(p)+'">'+zh+'</a>').join("")+'</nav>'+gate+'</div></footer>';
function rewrite(main){return main.replace(/href="(\/[^"]*)"/g,(_,url)=>{const [path,hash]=url.split("#");return 'href="'+href(path.replace(/^\/+|\/+$/g,""))+(hash?"#"+hash:"")+'"';});}
function document(title,main,current,url){return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>'+escapeHTML(title)+'</title><meta name="description" content="Shaiol 的个人网站、作品与公开创作笔记。"><meta name="theme-color" content="#ffffff"><link rel="canonical" href="'+url+'"><link rel="icon" href="'+prefix+'assets/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="'+prefix+'assets/site.css?v='+assetVersion+'"><script type="module" src="'+prefix+'assets/site.js?v='+assetVersion+'"></script></head><body data-base="'+prefix+'">'+header(current)+menu+'<div class="page-enter">'+main+'</div>'+footer+'</body></html>';}
const dist=resolve(root,"dist");await mkdir(dist,{recursive:true});await cp(resolve(root,"public"),dist,{recursive:true});
await writeFile(resolve(dist,"assets/site.js"),assets[1].replace('"./effects.js"','"./effects.js?v='+assetVersion+'"'));
for(const page of pages){const main=rewrite(await readFile(resolve(root,"src/pages/"+page.source+".html"),"utf8"));const dir=resolve(dist,page.path);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,"index.html"),document(page.title,main,page.nav,site+(page.path?page.path+"/":"")));}
const entries=await readJournal(root);
const journalDir=resolve(dist,"logs");await mkdir(journalDir,{recursive:true});
await writeFile(resolve(journalDir,"index.html"),document("工作日志 · Shaiol",journalIndex(entries,href),"",site+"logs/"));
for(const [index,entry] of entries.entries()){const dir=resolve(journalDir,entry.date);await mkdir(dir,{recursive:true});await writeFile(resolve(dir,"index.html"),document(entry.title+" · Shaiol",journalEntry(entry,index,entries,href),"",site+"logs/"+entry.date+"/"));}
await writeFile(resolve(dist,"404.html"),document("页面未找到 · Shaiol",'<main id="main" class="inner-page"><header class="page-heading"><h1>404</h1><p>这个页面不存在。</p></header><a class="backlink" href="'+prefix+'">← 返回首页</a></main>',"",site));
await writeFile(resolve(dist,".nojekyll"),"");
console.log("Built "+pages.length+" pages and "+entries.length+" journal entries with base "+prefix);

