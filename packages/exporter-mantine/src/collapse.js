/**
 * Variable-name collapsing shared by the exporter's surface coverage and the
 * inventory extractor. Its own module, with no import, so the extractor can run
 * before surface-inventory.json exists (surface-coverage.js imports it).
 */

/**
 * Collapse one resolver variable name to its inventory name. `palettes` are
 * the colour names that collapse to `<color>`; `named` are the palettes the
 * inventory keeps by name. A per-colour variant (`-filled`, `-light`, …)
 * always collapses: it is the same variable for every palette. Shades
 * collapse unless the palette is named, because the page reads
 * `--mantine-color-gray-6`, not any palette's 6. Used by the extractor on
 * Mantine's defaults and here on what the exporter emits.
 *
 * Mantine's names are ambiguous once a palette name contains a hyphen: with a
 * `primary-light` tuple next to a `primary` virtual colour,
 * `--mantine-color-primary-light-color` parses both ways. `suffixes`, the
 * variant suffixes the inventory knows, settles it: the parse must end in one.
 */
export function collapseVariable(name, palettes, named = [], suffixes = null) {
  if (/^--mantine-primary-color-\d$/.test(name)) return '--mantine-primary-color-<shade>';
  const prefix = '--mantine-color-';
  if (!name.startsWith(prefix)) return name;
  const rest = name.slice(prefix.length);
  // Longest palette first: a palette is `rest` up to one of its hyphens, so
  // try the hyphens right to left and look each prefix up, rather than test
  // every palette name against every variable (500 custom roles made that the
  // slowest step of a 10,000-token build, #97).
  const candidates = candidatesFor(palettes, named);
  for (let at = rest.lastIndexOf('-'); at !== -1; at = at === 0 ? -1 : rest.lastIndexOf('-', at - 1)) {
    const palette = rest.slice(0, at);
    if (!candidates.has(palette)) continue;
    const tail = rest.slice(at + 1);
    if (/^\d$/.test(tail)) {
      return named.includes(palette) ? `${prefix}${palette}-<shade>` : `${prefix}<color>-<shade>`;
    }
    if (!suffixes || suffixes.includes(tail)) return `${prefix}<color>-${tail}`;
  }
  return name;
}

/** The palette names as a set, built once per `palettes`/`named` pair. */
const candidateSets = new WeakMap();
function candidatesFor(palettes, named) {
  const cached = candidateSets.get(palettes);
  if (cached?.named === named) return cached.set;
  const set = new Set([...palettes, ...named]);
  candidateSets.set(palettes, { named, set });
  return set;
}
