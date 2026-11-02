(() => {
  const intro = document.querySelector(".intro-screen");
  if (!intro) return;

  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let seen = false;
  try { seen = !!sessionStorage.getItem("shaiol-intro-v4"); } catch {}
  if (motion.matches || seen) {
    intro.remove();
    return;
  }

  let timer;
  const finish = () => {
    clearTimeout(timer);
    intro.remove();
    document.documentElement.classList.remove("intro-playing");
    motion.removeEventListener("change", onMotionChange);
    window.removeEventListener("pagehide", finish);
  };
  const onMotionChange = event => { if (event.matches) finish(); };
  intro.querySelector("button").addEventListener("click", finish, {once: true});
  intro.addEventListener("animationend", event => {
    if (event.target === intro) finish();
  });
  motion.addEventListener("change", onMotionChange);
  window.addEventListener("pagehide", finish, {once: true});

  // Arm recovery before showing the overlay; no downloaded module is needed.
  timer = setTimeout(finish, 1750);
  document.documentElement.classList.add("intro-playing");
  intro.hidden = false;
  try { sessionStorage.setItem("shaiol-intro-v4", "seen"); } catch {}
})();
