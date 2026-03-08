import type { SessionStore } from "./store.js";
import type { Slug } from "./types.js";
import { asSlug } from "./types.js";

const ADJECTIVES = [
  "agile", "amber", "ashen", "brisk", "canny", "covert", "cozy", "crypt",
  "dusky", "eager", "faint", "feral", "fleet", "ghost", "glint", "hollow",
  "hidden", "little", "lithe", "lunar", "mellow", "mink", "misty", "nimble",
  "noisy", "padded", "petit", "playful", "quiet", "rapid", "restless", "russet",
  "sable", "secret", "shady", "silent", "sly", "snug", "soft", "spry",
  "swift", "tiny", "velvet", "warm", "wily",
];

const NOUNS = [
  "bandit", "borrow", "burrow", "cache", "cloak", "crawl", "crevice", "den",
  "drift", "dust", "echo", "fang", "flash", "footing", "frost", "glade",
  "gleam", "glen", "grove", "hideout", "hollow", "lair", "lantern", "leaf",
  "maze", "mischief", "moon", "moss", "nest", "nook", "outpost", "passage",
  "path", "paw", "pebble", "peek", "pelt", "pine", "plume", "pouch",
  "prowl", "riddle", "ridge", "route", "run", "scamper", "scheme", "scratch",
  "shade", "shadow", "shell", "shiver", "slink", "spark", "stash", "step",
  "stone", "stream", "stripe", "tail", "thicket", "thread", "tunnel", "turn",
  "vault", "veil", "whisker", "wisp", "warren", "way", "wink", "wood",
  "yard", "yarn", "yip", "zephyr", "zip", "zone", "track", "trail",
  "twitch", "snout", "sniff", "scramble", "ferret", "marten", "stoat", "weasel",
];
function buildSlug(num: number): Slug {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  return asSlug(`${adj}-${noun}-${num}`);
}

export function generateSlug(): Slug {
  return buildSlug(Math.floor(1000 + Math.random() * 9000));
}

export function generateUniqueSlug(store: SessionStore): Slug {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug();
    if (!store.has(slug)) {
      return slug;
    }
  }
  return buildSlug(Math.floor(10000 + Math.random() * 90000));
}
