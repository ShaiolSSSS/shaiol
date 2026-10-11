import Lenis from "./vendor/lenis-1.3.26.js";

const finePointer = matchMedia("(hover: hover) and (pointer: fine)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// Keep the dot outside animated page wrappers so its fixed position and blending stay correct.
const dot = document.createElement("div");
dot.className = "mouse-dot";
dot.setAttribute("aria-hidden", "true");
document.body.append(dot);
let cursorFrame = 0, visible = false, x = 0, y = 0, targetX = 0, targetY = 0, lastCursorTime = 0;
const hasModal = () => !!document.querySelector("dialog[open]");

function hideCursor() {
  visible = false;
  cancelAnimationFrame(cursorFrame);
  cursorFrame = 0;
  document.documentElement.classList.remove("has-mouse-dot");
  dot.classList.remove("is-visible");
}

function drawCursor(time) {
  cursorFrame = 0;
  if (!visible) return;
  const elapsed = Math.min(time - lastCursorTime || 16, 50);
  lastCursorTime = time;
  const follow = reducedMotion.matches ? 1 : 1 - Math.exp(-elapsed / 65);
  x += (targetX - x) * follow;
  y += (targetY - y) * follow;
  dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
  if (Math.abs(targetX - x) + Math.abs(targetY - y) > .1) cursorFrame = requestAnimationFrame(drawCursor);
}

document.addEventListener("pointermove", event => {
  const element = event.target instanceof Element ? event.target : null;
  if (!finePointer.matches || event.pointerType !== "mouse" || hasModal() ||
      element?.closest("input, textarea, select, [contenteditable], iframe")) {
    hideCursor();
    return;
  }
  targetX = event.clientX;
  targetY = event.clientY;
  if (!visible) {
    x = targetX;
    y = targetY;
    lastCursorTime = 0;
    visible = true;
    document.documentElement.classList.add("has-mouse-dot");
    dot.classList.add("is-visible");
  }
  dot.classList.toggle("is-link", !!element?.closest("a, button, [role=button]"));
  if (!cursorFrame) cursorFrame = requestAnimationFrame(drawCursor);
}, {passive: true});
document.documentElement.addEventListener("pointerleave", hideCursor);
window.addEventListener("blur", hideCursor);
document.addEventListener("keydown", hideCursor);
finePointer.addEventListener("change", hideCursor);

// Lenis keeps one continuous animation across wheel bursts and normalizes input devices.
// Suspend it entirely for modals and reduced motion so browser-native input stays available.
let smoothScroll = null;
function updateScroll() {
  const enabled = finePointer.matches && !reducedMotion.matches && !hasModal() && !document.hidden;
  if (!enabled) {
    smoothScroll?.destroy();
    smoothScroll = null;
    return;
  }
  if (smoothScroll) return;
  smoothScroll = new Lenis({
    autoRaf: true,
    lerp: .075,
    smoothWheel: true,
    syncTouch: false,
    anchors: true,
    allowNestedScroll: true,
    stopInertiaOnNavigate: true,
    prevent: node => node.matches("input, textarea, select, [contenteditable], iframe"),
    virtualScroll: ({event, deltaX, deltaY}) => !event.metaKey && !event.shiftKey && Math.abs(deltaY) >= Math.abs(deltaX),
  });
}
function interruptScroll() {
  smoothScroll?.scrollTo(window.scrollY, {immediate: true});
}
for (const event of ["pointerdown", "touchstart", "keydown", "blur"]) {
  window.addEventListener(event, interruptScroll, {passive: true});
}
finePointer.addEventListener("change", updateScroll);
reducedMotion.addEventListener("change", updateScroll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hideCursor();
  updateScroll();
});
new MutationObserver(() => {
  if (hasModal()) hideCursor();
  updateScroll();
}).observe(document.body, {subtree: true, attributes: true, attributeFilter: ["open"]});
updateScroll();
