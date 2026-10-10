/**
 * AL3 for Chakra UI: classify every entry of Chakra's theming surface
 * (surface-inventory.json, extracted from `defaultConfig` by
 * tools/extract-surface.mjs) against the config this exporter emits. The
 * exporter turns it into report.json rows; scripts/check-coverage-bar.mjs
 * reconciles those rows against the inventory, so the two read the same
 * classification.
 *
 * Chakra's surface is a graph like Mantine's: semantic tokens read tokens
 * (`bg.subtle` is `{colors.gray.50}`), text styles read font sizes, and
 * recipes read all of them (`px: "4"` is `spacing.4`). So an entry is one of
 * three things (the walk is @transtyle/ir's, shared with Mantine):
 *
 *   set     — the emitted config writes it: a token, a semantic token, a
 *             breakpoint, a style or recipe leaf, the default palette route.
 *   follows — not written, but everything it reads is set or follows, so
 *             Chakra derives it from this theme: `recipes.button.base.borderRadius`
 *             reads `l2`, which this theme sets.
 *   default — something it reads stays Chakra's. In the token tiers every
 *             one is reported on its own row with the reason (REASONS below);
 *             in the recipe tier, where thousands of leaves are on Chakra's
 *             default only because a token they read is, the family row
 *             counts them and the token's own row says why.
 */

// A JSON module, not a file read: exporters never touch a filesystem, so the
// exporter also runs in a browser bundle (@transtyle/core/browser).
import inventory from '../surface-inventory.json' with { type: 'json' };
import { surfaceRows as rowsFor, surfaceStatus } from '@transtyle/ir';

/** The checked-in inventory. */
export function INVENTORY() {
  return inventory;
}

/** Families reported by their summary row alone: their defaults are explained by what they read. */
export const DERIVED_FAMILIES = ['recipes', 'slotRecipes'];

/**
 * The reason for an entry with none of its own. The four examples author
 * everything the exporter maps, so check:coverage-bar refuses this note
 * there: an entry new in a Chakra upgrade still has to get a real reason.
 */
export const UNMAPPED = {
  cls: 'unsupported',
  note: "this design system defines nothing the exporter maps to this entry, so Chakra's value stays",
};

/**
 * Why an entry keeps Chakra's value: `[pattern, reason]`, first match wins,
 * matched against the inventory id. `cls` is `unsupported` (Chakra has the
 * slot, the catalog has no concept for it) or `dropped` (the catalog has it,
 * Chakra's surface does not read it, or reads it somewhere this exporter does
 * not write); `slot` names the catalog side when there is one; `meaning` is
 * the report's catalog-signal key (docs/findings/catalog-meanings.json) for
 * an `unsupported` one. A function receives the id's match.
 */
export const REASONS = [
  // ---- colours ----
  [
    /^semanticTokens\.colors\.<palette>\./,
    {
      cls: 'unsupported',
      meaning: 'color.named-palette',
      note: "Chakra's hue palettes (gray, red, blue, …) keep their own colours: the exporter never rebinds a hue name, and gives each role a palette of its own instead (colorPalette=\"primary\")",
    },
  ],
  [
    /^tokens\.colors\.(<palette>|whiteAlpha|blackAlpha)\.<shade>$/,
    {
      cls: 'unsupported',
      meaning: 'color.named-palette',
      note: "Chakra's colour ramps, kept: no recipe reads a role through them (the exporter writes no role ramps), and the hue and alpha scales stay what their names say",
    },
  ],
  [
    /^tokens\.colors\.(black|white)$/,
    {
      cls: 'unsupported',
      meaning: 'color.named-palette',
      note: "Chakra's own black and white, kept: the surfaces and text they seed (bg, fg, the contrast keys) are set from the design system directly",
    },
  ],
  [
    /^tokens\.colors\.(transparent|current)$/,
    { cls: 'unsupported', meaning: 'target.config', note: 'a CSS keyword (transparent, currentColor) Chakra names as a token: not a design value' },
  ],

  // ---- typography ----
  [
    /^tokens\.fontSizes\.(2xs|5xl|6xl|7xl|8xl|9xl)$/,
    (m) =>
      m[1] === '2xs'
        ? { cls: 'unsupported', meaning: 'scale.extra-rung', note: "below the catalog's type scale, which starts at xs: Chakra's 2xs (the smallest badges and tags) stays" }
        : {
            cls: 'unsupported',
            meaning: 'type.display-ladder',
            note: "above the catalog's type scale, which stops at 4xl: Chakra's display sizes run to 9xl, and mapping them would invent rungs",
          },
  ],
  [
    /^tokens\.fontWeights\.(thin|extralight|light|extrabold|black)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's weight scale has regular, medium, semibold and bold; Chakra's other five weights stay" },
  ],
  [
    /^tokens\.lineHeights\.(shorter|taller)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's leading has three rungs, mapped by rank to short, moderate and tall; Chakra's outer two stay" },
  ],
  [
    /^tokens\.letterSpacings\.(tighter|wider|widest)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's tracking has tight, normal and wide; Chakra's outer rungs stay" },
  ],
  [
    /^textStyles\.[^.]+\.(lineHeight|letterSpacing)$/,
    (m) => ({
      cls: 'dropped',
      slot: m[1] === 'lineHeight' ? 'semantic.type.leading.*' : 'semantic.type.tracking.*',
      note: `Chakra's text styles write their ${m[1] === 'lineHeight' ? 'line height' : 'letter spacing'} as a literal, not as a token, so the design system's ${m[1] === 'lineHeight' ? 'leading' : 'tracking'} does not reach them; the design system's own type roles are text styles of their own (textStyle="heading.lg")`,
    }),
  ],

  // ---- scales ----
  [
    /^tokens\.radii\.(2xs|xs|2xl|3xl|4xl)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's radius scale has none, sm, md, lg, xl and full; Chakra's other rungs stay (l1, l2 and l3, what the recipes read, are set)" },
  ],
  [
    /^tokens\.spacing\.(.+)$/,
    (m) => ({
      cls: 'unsupported',
      meaning: 'scale.extra-rung',
      note: m[1].includes('.')
        ? `a half step: the catalog's space scale has whole steps only, so Chakra's ${m[1]} stays`
        : `the catalog's space scale has no ${m[1]} step, so Chakra's stays`,
    }),
  ],
  [
    /^tokens\.sizes\.<step>$/,
    {
      cls: 'dropped',
      slot: 'semantic.space.*',
      note: "Chakra's sizes repeat its spacing steps as literal values (sizes.10 is 2.5rem again, not a reference), so the design system's space scale does not reach them; control heights, what the recipes size by them, are set on the recipes from size.control instead",
    },
  ],
  [
    /^tokens\.sizes\.(<fraction>|<keyword>)$/,
    { cls: 'unsupported', meaning: 'target.config', note: 'percentages, CSS keywords and viewport units Chakra names as sizes: constants, not design values' },
  ],
  [
    /^tokens\.sizes\.(3xs|2xs|xs|sm|md|lg|xl|[2-8]xl|prose)$/,
    {
      cls: 'unsupported',
      meaning: 'geometry.component',
      note: "Chakra's measure scale, the widths its recipes give dialogs, drawers, popovers, tooltips and menus: bespoke component geometry, which the catalog does not carry",
    },
  ],
  [
    /^tokens\.durations\.(faster|slowest)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's durations have five rungs (instant to slower); Chakra's faster and slowest stay" },
  ],
  [
    /^tokens\.easings\.ease-in-smooth$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "Chakra's own smooth ease-in curve (dialogs and drawers); the catalog's easings are standard, enter, exit, emphasized and spring" },
  ],
  [
    /^tokens\.zIndex\.(docked|skipNav|max)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog's z ladder has no docked, skip-link or maximum layer; Chakra's stay" },
  ],
  [
    /^tokens\.borders\./,
    {
      cls: 'dropped',
      slot: 'semantic.border-width.*',
      note: "Chakra's borders are width-and-style shorthands that no recipe reads (the recipes write borderWidth: 1px literally), so setting them would change nothing",
    },
  ],
  [/^tokens\.cursor\./, { cls: 'unsupported', meaning: 'target.config', note: 'the cursor Chakra gives a kind of control: a behaviour choice, not a design value' }],
  [/^tokens\.aspectRatios\./, { cls: 'unsupported', meaning: 'target.config', note: "a named aspect ratio for media (Chakra's AspectRatio): a layout constant, not a design-system value" }],
  [/^tokens\.animations\./, { cls: 'unsupported', meaning: 'motion.keyframes', note: 'a keyframe animation (spin, ping, pulse, bounce): the catalog has durations and easings, no animations' }],
  [/^tokens\.blurs\./, { cls: 'unsupported', meaning: 'effect.blur', note: 'a blur radius (backdrop and filter blur): the catalog has no blur scale' }],

  // ---- shadows ----
  [
    /^semanticTokens\.shadows\.(xs|2xl)$/,
    { cls: 'unsupported', meaning: 'scale.extra-rung', note: "the catalog has four elevation shadows, mapped by rank to sm, md, lg and xl; Chakra's xs and 2xl stay" },
  ],
  [/^semanticTokens\.shadows\.(inner|inset)$/, { cls: 'unsupported', meaning: 'shadow.inset', note: 'an inset shadow: the elevation shadows have no inset counterpart in the catalog' }],

  // ---- styles ----
  [/^layerStyles\.disabled\.cursor$/, { cls: 'unsupported', meaning: 'target.config', note: 'the not-allowed cursor on disabled controls: a behaviour choice, not a design value' }],
  [
    /^layerStyles\.[^.]+\.[^.]+\.borderWidth$/,
    { cls: 'dropped', slot: 'semantic.border-width.*', note: "a literal 1px in Chakra's outline layer style, like the recipes' borders: no token to set" },
  ],
];

/** The default palette route stays `gray` only when the design system has no neutral role. */
const PALETTE_NOT_ROUTED = {
  cls: 'unsupported',
  note: "the design system has no neutral role to route Chakra's default palette at, so components without a colorPalette wear Chakra's gray",
};

/** A token-tier entry on Chakra's default only because something it reads is. */
const derivedReason = (deps, reasonOf) => {
  const first = reasonOf(deps[0]);
  return {
    cls: first?.cls ?? 'unsupported',
    ...(first?.meaning ? { meaning: first.meaning } : {}),
    note: `reads ${deps.join(', ')}, which ${deps.length === 1 ? 'keeps' : 'keep'} Chakra's value (see ${deps.length === 1 ? 'that row' : 'those rows'})`,
  };
};

const leaf = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);

/**
 * Classify the inventory against the emitted config (`{ globalCss, theme }`,
 * the object `defineConfig()` receives). `mapped` is the exporter's
 * `Map<inventory id, catalog slot>` of every entry it writes from a catalog
 * slot, so one left on Chakra's default for want of that slot names it.
 */
export function classifySurface(inv, config, mapped = new Map()) {
  const routed = config.globalCss?.html?.colorPalette;
  const isSet = (entry) => {
    if (entry.block === 'colorPalette' && !entry.path) {
      const key = entry.id.slice('colorPalette.'.length);
      return !!routed && config.theme?.semanticTokens?.colors?.[routed]?.[key] !== undefined;
    }
    return entry.path ? leaf(config, entry.path) !== undefined : false;
  };
  const status = surfaceStatus(inv.entries, isSet);
  const byId = new Map(inv.entries.map((e) => [e.id, e]));

  const own = (id) => {
    if (id === 'colorPalette.default') return PALETTE_NOT_ROUTED;
    if (mapped.has(id)) {
      const slot = mapped.get(id);
      return { cls: 'unsupported', slot, note: `set whenever the design system defines ${slot}; this one does not, so Chakra's value stays` };
    }
    for (const [pattern, reason] of REASONS) {
      const m = pattern.exec(id);
      if (m) return typeof reason === 'function' ? reason(m) : reason;
    }
    return null;
  };
  const reasons = new Map();
  const reasonOf = (id) => {
    if (reasons.has(id)) return reasons.get(id);
    reasons.set(id, UNMAPPED); // cycle guard
    const entry = byId.get(id);
    const deps = (entry?.from ?? []).filter((d) => status.get(d) === 'default');
    // An entry this exporter could write (a path into the config) but did
    // not is explained by its own reason first; one that only reads
    // defaults is explained by them.
    const r = own(id) ?? (deps.length ? derivedReason(deps, reasonOf) : UNMAPPED);
    reasons.set(id, r);
    return r;
  };
  return inv.entries.map((entry) => {
    const s = status.get(entry.id);
    const reason = s === 'default' && !DERIVED_FAMILIES.includes(entry.block) ? reasonOf(entry.id) : null;
    return { entry, status: s, reason };
  });
}

/** report.json rows for the emitted config. */
export function surfaceRows(config, mapped, inv = INVENTORY()) {
  return rowsFor({
    classified: classifySurface(inv, config, mapped),
    families: Object.keys(inv.counts.families),
    target: 'Chakra',
    source: `@chakra-ui/react ${inv.chakraVersion}`,
    derived: DERIVED_FAMILIES,
  });
}
