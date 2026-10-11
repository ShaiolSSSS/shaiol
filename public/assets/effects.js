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

// Interpolate the real scroll position rather than translating the page.
// Fixed navigation, anchors, selection and the scrollbar therefore keep their normal behavior.
let scrollFrame = 0, scrollTarget = scrollY, expectedY = scrollY, lastScrollTime = 0;
const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - innerHeight);
const clampScroll = value => Math.max(0, Math.min(maxScroll(), value));

function stopScroll() {
  cancelAnimationFrame(scrollFrame);
  scrollFrame = 0;
  scrollTarget = expectedY = scrollY;
  lastScrollTime = 0;
  document.documentElement.classList.remove("has-scroll-inertia");
}

function drawScroll(time) {
  scrollFrame = 0;
  if (reducedMotion.matches || hasModal()) { stopScroll(); return; }
  const elapsed = Math.min(time - lastScrollTime || 16, 50);
  lastScrollTime = time;
  scrollTarget = clampScroll(scrollTarget);
  const distance = scrollTarget - expectedY;
  expectedY = Math.abs(distance) < .5 ? scrollTarget : expectedY + distance * (1 - Math.exp(-elapsed / 125));
  window.scrollTo({top: expectedY, behavior: "instant"});
  if (Math.abs(scrollTarget - expectedY) > .5) scrollFrame = requestAnimationFrame(drawScroll);
  else stopScroll();
}

function usesNativeScroll(element) {
  if (element?.closest("input, textarea, select, [contenteditable], iframe")) return true;
  for (let node = element; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
    const style = getComputedStyle(node);
    if (/(auto|scroll)/.test(style.overflowY) && node.scrollHeight > node.clientHeight + 1) return true;
  }
  return false;
}

window.addEventListener("wheel", event => {
  if (!finePointer.matches || reducedMotion.matches || hasModal() || !event.cancelable ||
      event.defaultPrevented || event.ctrlKey || event.metaKey || event.shiftKey ||
      Math.abs(event.deltaX) > Math.abs(event.deltaY) || !event.deltaY ||
      usesNativeScroll(event.target instanceof Element ? event.target : null)) {
    stopScroll();
    return;
  }
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? innerHeight : 1;
  if (!scrollFrame) scrollTarget = expectedY = scrollY;
  const destination = clampScroll(scrollTarget + event.deltaY * unit);
  if (destination === scrollY && !scrollFrame) return;
  event.preventDefault();
  scrollTarget = destination;
  document.documentElement.classList.add("has-scroll-inertia");
  if (!scrollFrame) scrollFrame = requestAnimationFrame(drawScroll);
}, {passive: false});

// Stop immediately when another input method or browser navigation takes over.
window.addEventListener("scroll", () => {
  if (scrollFrame && Math.abs(scrollY - expectedY) > 2) stopScroll();
}, {passive: true});
for (const event of ["pointerdown", "touchstart", "keydown", "resize", "hashchange", "pagehide", "blur"]) {
  window.addEventListener(event, stopScroll, {passive: true});
}
finePointer.addEventListener("change", stopScroll);
reducedMotion.addEventListener("change", stopScroll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) { hideCursor(); stopScroll(); }
});
new MutationObserver(() => {
  if (hasModal()) { hideCursor(); stopScroll(); }
}).observe(document.body, {subtree: true, attributes: true, attributeFilter: ["open"]});
