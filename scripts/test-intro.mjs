import assert from "node:assert/strict";
import {readFile, readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {runInNewContext} from "node:vm";
import {test} from "node:test";

const root = resolve(import.meta.dirname, "..");
const source = await readFile(resolve(root, "public/assets/intro.js"), "utf8");
function events() {
  const handlers = new Map();
  return {
    addEventListener: (name, fn) => handlers.set(name, fn),
    removeEventListener: name => handlers.delete(name),
    emit: (name, event) => handlers.get(name)?.(event),
  };
}
function start({seen = false, reduced = false, storageBlocked = false} = {}) {
  const classes = new Set(), timers = new Map(), button = events();
  const intro = {...events(), hidden: true, removed: false,
    querySelector: () => button, remove() { this.removed = true; }};
  const motion = {...events(), matches: reduced};
  let remembered = seen;
  const context = {
    document: {querySelector: () => intro, documentElement: {classList: {
      add: name => classes.add(name), remove: name => classes.delete(name),
    }}},
    matchMedia: () => motion,
    sessionStorage: {
      getItem() { if (storageBlocked) throw new Error("blocked"); return remembered; },
      setItem(key, value) { if (storageBlocked) throw new Error("blocked"); remembered = value; },
    },
    window: events(),
    setTimeout(fn, delay) { timers.set(1, {fn, delay}); return 1; },
    clearTimeout(id) { timers.delete(id); },
  };
  runInNewContext(source, context);
  return {intro, button, motion, classes, timers, context, remembered};
}

test("every generated page boots its welcome screen before any site content", async () => {
  let count = 0;
  async function check(dir) {
    for (const entry of await readdir(dir, {withFileTypes: true})) {
      const path = resolve(dir, entry.name);
      if (entry.isDirectory()) { await check(path); continue; }
      if (!entry.name.endsWith(".html")) continue;
      const html = await readFile(path, "utf8");
      const body = html.indexOf("<body ");
      const overlay = html.indexOf('class="intro-screen intro-welcome" hidden', body);
      const boot = html.indexOf("<script>" + source, overlay);
      const header = html.indexOf('class="site-header"', body);
      assert.ok(body < overlay && overlay < boot && boot < header, path);
      assert.ok(html.indexOf("<style>") < html.indexOf('rel="stylesheet"'), path);
      count++;
    }
  }
  await check(resolve(root, "dist"));
  assert.ok(count >= 6);
});

test("first visit starts without any downloaded module; skip releases the screen", () => {
  const state = start();
  assert.equal(state.intro.hidden, false);
  assert.equal(state.remembered, "seen");
  assert.ok(state.classes.has("intro-playing"));
  assert.equal(state.timers.get(1).delay, 1750);
  state.button.emit("click");
  assert.ok(state.intro.removed);
  assert.equal(state.classes.size, 0);
  assert.equal(state.timers.size, 0);
});

test("repeat visits and reduced motion show the page directly", () => {
  for (const options of [{seen: true}, {reduced: true}]) {
    const state = start(options);
    assert.ok(state.intro.removed);
    assert.equal(state.classes.size, 0);
    assert.equal(state.timers.size, 0);
  }
});

test("blocked session storage still recovers if no animation event arrives", () => {
  const state = start({storageBlocked: true});
  assert.equal(state.intro.hidden, false);
  state.timers.get(1).fn();
  assert.ok(state.intro.removed);
  assert.equal(state.classes.size, 0);
});

test("child animations do not end the welcome screen; its exit does", () => {
  const state = start();
  state.intro.emit("animationend", {target: {}});
  assert.equal(state.intro.removed, false);
  state.intro.emit("animationend", {target: state.intro});
  assert.ok(state.intro.removed);
  assert.equal(state.classes.size, 0);
});

test("changing motion preference or leaving the page releases the screen", () => {
  const motion = start();
  motion.motion.emit("change", {matches: true});
  assert.ok(motion.intro.removed);
  assert.equal(motion.classes.size, 0);
  const leaving = start();
  leaving.context.window.emit("pagehide");
  assert.ok(leaving.intro.removed);
  assert.equal(leaving.classes.size, 0);
});
