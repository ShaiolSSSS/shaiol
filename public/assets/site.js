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
const star=document.querySelector(".secretstar"),door=document.querySelector(".secret-gate"),form=door.querySelector("form"),input=door.querySelector("input"),message=door.querySelector('[role="status"]'),submit=door.querySelector(".unlock"),footer=door.closest(".footer-bottom");
let count=0,last=0,busy=false,generation=0;
function closeGate(restoreFocus=false){
generation++;count=0;last=0;door.classList.remove("is-open");footer.classList.remove("gate-open");star.setAttribute("aria-expanded","false");star.setAttribute("aria-label","星星");form.inert=true;form.setAttribute("aria-hidden","true");input.value="";input.removeAttribute("aria-invalid");message.textContent="";busy=false;input.disabled=false;submit.disabled=false;submit.textContent="↗";submit.setAttribute("aria-label","打开星门");form.removeAttribute("aria-busy");if(restoreFocus)star.focus({preventScroll:true});
}
star.addEventListener("click",()=>{
if(door.classList.contains("is-open")){closeGate(true);return;}
const now=Date.now();count=now-last<1800?count+1:1;last=now;
if(count>=3){count=0;door.classList.add("is-open");footer.classList.add("gate-open");star.setAttribute("aria-expanded","true");star.setAttribute("aria-label","收起星门");form.inert=false;form.setAttribute("aria-hidden","false");input.focus();requestAnimationFrame(()=>{if(door.classList.contains("is-open"))input.scrollIntoView({block:"nearest",behavior:"instant"});});}
});
document.addEventListener("pointerdown",event=>{if(door.classList.contains("is-open")&&!door.contains(event.target))closeGate();});
document.addEventListener("keydown",event=>{if(event.key==="Escape"&&door.classList.contains("is-open")){event.preventDefault();closeGate(true);}});
input.addEventListener("input",()=>{input.removeAttribute("aria-invalid");message.textContent="";});
const bytes=value=>Uint8Array.from(atob(value),c=>c.charCodeAt(0));
form.addEventListener("submit",async event=>{
event.preventDefault();if(busy||!door.classList.contains("is-open"))return;busy=true;const attempt=generation;const code=input.value.trim();input.disabled=true;submit.disabled=true;input.removeAttribute("aria-invalid");message.textContent="";submit.textContent="…";submit.setAttribute("aria-label","星门开启中");form.setAttribute("aria-busy","true");
try{const response=await fetch(base+"assets/gate.json",{cache:"no-store"});if(!response.ok)throw new Error("network");const gate=await response.json();const material=await crypto.subtle.importKey("raw",new TextEncoder().encode(code),"PBKDF2",false,["deriveKey"]);const key=await crypto.subtle.deriveKey({name:"PBKDF2",hash:"SHA-256",salt:bytes(gate.salt),iterations:gate.iterations},material,{name:"AES-GCM",length:256},false,["decrypt"]);let decoded;try{decoded=await crypto.subtle.decrypt({name:"AES-GCM",iv:bytes(gate.iv)},key,bytes(gate.ciphertext));}catch{if(attempt===generation){message.textContent="口令不正确，星门还没有打开。";input.setAttribute("aria-invalid","true");}return;}if(attempt!==generation)return;const destination=JSON.parse(new TextDecoder().decode(decoded)).destination;const target=new URL(destination);if(target.href!=="https://shaiolssss.github.io/shaiol/logs/")throw new Error("invalid");input.value="";location.assign(new URL(base+"logs/",location.origin).href);
}catch{if(attempt===generation)message.textContent="星门暂时没有回应，请检查网络后再试。";}finally{if(attempt===generation){busy=false;input.disabled=false;submit.disabled=false;submit.textContent="↗";submit.setAttribute("aria-label","打开星门");form.removeAttribute("aria-busy");input.focus({preventScroll:true});}}});

