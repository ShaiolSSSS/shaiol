import "./effects.js";
const base=document.body.dataset.base;
const menu=document.querySelector("#site-menu"),toggle=document.querySelector(".menu-toggle");
toggle.addEventListener("click",()=>{menu.showModal();toggle.setAttribute("aria-expanded","true");document.body.style.overflow="hidden";});
menu.querySelector(".menu-close").addEventListener("click",()=>menu.close());
menu.addEventListener("close",()=>{toggle.setAttribute("aria-expanded","false");document.body.style.overflow="";});
menu.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>menu.close()));
const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
if(!reduced){let show=true;try{show=!sessionStorage.getItem("shaiol-intro-v4");sessionStorage.setItem("shaiol-intro-v4","seen");}catch{}
if(show){const intro=document.createElement("div");intro.className="intro-screen intro-welcome";intro.innerHTML='<div class="intro-word" aria-label="WELCOME">'+[..."WELCOME"].map((letter,index)=>'<span class="intro-letter" aria-hidden="true" style="--letter:'+index+'">'+letter+'</span>').join("")+'<span class="intro-line" aria-hidden="true"></span></div><button>跳过 ↗</button>';document.body.append(intro);const finish=()=>intro.remove();intro.querySelector("button").addEventListener("click",finish);intro.addEventListener("animationend",event=>{if(event.target===intro)finish();});setTimeout(finish,1750);}}
const star=document.querySelector(".secretstar"),door=document.querySelector(".secretdialog"),input=door.querySelector("input"),message=door.querySelector('[role="status"]'),submit=door.querySelector(".unlock");
let count=0,last=0,busy=false,generation=0;
star.addEventListener("click",()=>{const now=Date.now();count=now-last<1800?count+1:1;last=now;if(count>=3){count=0;door.showModal();input.focus();}});
door.querySelector(".close").addEventListener("click",()=>door.close());
door.addEventListener("click",e=>{if(e.target===door){const r=door.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)door.close();}});
door.addEventListener("close",()=>{generation++;input.value="";message.textContent="";busy=false;input.disabled=false;submit.disabled=false;submit.textContent="打开星门 ↗";});
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
door.querySelector("form").addEventListener("submit",async event=>{
event.preventDefault();if(busy)return;busy=true;const attempt=generation;const code=input.value.trim();input.disabled=true;submit.disabled=true;message.textContent="";submit.textContent="星门开启中…";
try{const response=await fetch(base+"assets/gate.json",{cache:"no-store"});if(!response.ok)throw new Error("network");const gate=await response.json();const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(code),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:bytes(gate.salt),iterations:gate.iterations},material,{name:"AES-GCM",length:256},false,["decrypt"]);let decoded;try{decoded=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(gate.iv)},key,bytes(gate.ciphertext));}catch{if(attempt===generation)message.textContent="口令不正确，星门还没有打开。";return;}if(attempt!==generation)return;const destination=JSON.parse(new TextDecoder().decode(decoded)).destination;const target=new URL(destination);if(target.href!=="https://shaiolssss.github.io/shaiol/logs/")throw new Error("invalid");input.value="";location.assign(new URL(base+"logs/",location.origin).href);
}catch{if(attempt===generation)message.textContent="星门暂时没有回应，请检查网络后再试。";}finally{if(attempt===generation){busy=false;input.disabled=false;submit.disabled=false;submit.textContent="打开星门 ↗";}}});

