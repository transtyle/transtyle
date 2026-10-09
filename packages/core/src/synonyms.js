/**
 * The name table `bind --suggest` reads token names with (suggest.js,
 * docs/specs/cli.md "bind --suggest"). Versioned data, like the rule pack:
 * `synonyms@2` is written into every suggestion, so a change to this table
 * shows up in review as a version bump, not as a silent change of advice.
 *
 * A token's name is read by structure, not by substring. Its words (the path
 * after `semantic.color.` / `semantic.font.` / `option.color.` / `option.font.`,
 * split on `.`, `-`, `_` and camelCase) are matched whole, and a **family**
 * word decides what the token is before a role word can: in
 * `carbon.text-primary` and `govuk.secondary-text`, `text` makes them text
 * rungs, so `primary` / `secondary` qualify the rung instead of naming the
 * role. That is the false-friend rule. Family precedence, first match wins:
 * focus/ring, link, text, surface, border, status, role.
 *
 * `@2` (proposal 0005): an inverse word turns a text name into `inverse.text`
 * and a surface name into `inverse.surface`, the inverse pair. Carbon's
 * `text-inverse`, Material's `inverse-on-surface` and Fluent's
 * `NeutralForegroundInverted` are all the text on the inverted surface, never
 * the other mode's body text that `text.inverse` is, so no name proposes
 * `text.inverse` any more. A border name reads as `border.base`.
 *
 * Words that are not here mean nothing: `tube`, `scanline` or `meltdown`
 * (examples/cathode) are left to the value signals. Adding a word to fit one
 * design system is how a table like this goes wrong; a new word needs a
 * second, independent vocabulary that uses it the same way.
 */

export const SYNONYMS_VERSION = 'synonyms@2';

/** Family words. A token with one of these is that family whatever else its name says. */
export const FAMILY_WORDS = {
  ring: ['focus', 'ring', 'focusring'],
  link: ['link', 'links', 'hyperlink', 'anchor'],
  text: ['text', 'fg', 'foreground', 'content', 'ink', 'copy'],
  surface: ['background', 'bg', 'surface', 'canvas', 'layer', 'backdrop'],
  border: ['border', 'divider', 'stroke', 'outline', 'rule', 'separator', 'hairline'],
};

/** Status words → the built-in status role they name. */
export const STATUS_WORDS = {
  danger: ['danger', 'error', 'critical', 'negative', 'destructive', 'invalid'],
  warning: ['warning', 'warn', 'caution', 'attention'],
  success: ['success', 'positive', 'valid'],
  info: ['info', 'information', 'informative', 'notice'],
};

/** Role words → the built-in brand role they name (outside a family). `neutral` is never proposed. */
export const ROLE_WORDS = {
  primary: ['primary', 'brand', 'action', 'interactive', 'cta'],
  secondary: ['secondary'],
  accent: ['accent'],
};

/** Text-rung qualifiers; a text-family name with none of them is `text.base`. */
export const RUNG_WORDS = {
  base: ['primary', 'base', 'default', 'body', 'main', 'normal', 'regular'],
  muted: ['secondary', 'muted', 'subdued', 'dim', 'faded', 'helper', 'soft', 'quiet'],
  subtle: ['tertiary', 'subtle', 'placeholder', 'hint'],
  strong: ['strong', 'emphasis', 'emphasized', 'heading'],
  disabled: ['disabled', 'inactive'],
  inverse: ['inverse', 'inverted', 'reversed'],
};

/** Link-state qualifiers; any other state word makes a link token no catalog slot. */
export const LINK_WORDS = { hover: ['hover'], visited: ['visited'] };

/**
 * State and variant words: a token carrying one is a state or a variant of a
 * color, not the color itself, so `brand-hover` or `error-light` is never
 * proposed for a `.solid` (and `link-active` for no link slot).
 */
export const STATE_WORDS = [
  'hover', 'active', 'pressed', 'selected', 'disabled', 'visited', 'tint', 'subtle', 'muted', 'weak',
  'light', 'lighter', 'dark', 'darker', 'on', 'contrast', 'inverse', 'alt',
];

/** Interaction states: the only words that disqualify a border, surface or ring (`border-subtle` is still a border). */
export const INTERACTION_WORDS = ['hover', 'active', 'pressed', 'selected', 'disabled', 'visited'];

/** Font words → the catalog font slot they name. */
export const FONT_WORDS = {
  mono: ['mono', 'monospace', 'code', 'fixed'],
  sans: ['sans', 'body', 'ui', 'base', 'text', 'default'],
  display: ['display', 'heading', 'headline'],
};

/** The generic family that ends a font stack → the font slot it is evidence for. */
export const FONT_GENERICS = {
  monospace: 'mono',
  'ui-monospace': 'mono',
  'sans-serif': 'sans',
  'system-ui': 'sans',
  'ui-sans-serif': 'sans',
};

/** The words of a token path below its tier and type (`semantic.color.govuk.secondary-text` → govuk, secondary, text). */
export function nameWords(path) {
  const segs = path.split('.');
  const rest = segs[1] === 'color' || segs[1] === 'font' ? segs.slice(2) : segs.slice(1);
  return rest
    .flatMap((s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').split(/[-_]/))
    .map((w) => w.toLowerCase())
    .filter(Boolean);
}

const hit = (words, list) => words.find((w) => list.includes(w));

/**
 * Read a color token's name. Returns null when the name says nothing, or
 * `{ family, slot, words }`: `slot` is the catalog slot the name places the
 * token in (relative to `semantic.color.`, e.g. `text.muted`, `danger.solid`,
 * `elevation.surface` for "a surface, level by value"), or null when the name
 * claims a family that has no slot for it (`focus-text`, `link-active`,
 * `error-background`). A claimed token is never proposed elsewhere on value
 * alone (suggest.js).
 */
export function readColorName(path) {
  const words = nameWords(path);
  const family = (f) => hit(words, FAMILY_WORDS[f]);
  const status = Object.entries(STATUS_WORDS).find(([, list]) => hit(words, list));
  const role = Object.entries(ROLE_WORDS).find(([, list]) => hit(words, list));
  const state = hit(words, STATE_WORDS);
  const interaction = hit(words, INTERACTION_WORDS);
  // The matched words in the order the name has them (`secondary-text`, not `text-secondary`).
  const claim = (fam, slot, matched) => ({ family: fam, slot, words: words.filter((w, i) => matched.includes(w) && words.indexOf(w) === i) });

  const ring = family('ring');
  if (ring) {
    // `outline-focus` is the ring; `focus-text`, `focus-background` are other things in the focus family.
    const other = family('text') ?? family('link') ?? family('surface');
    return claim('ring', other || interaction ? null : 'ring', [ring, other]);
  }
  const link = family('link');
  if (link) {
    const kind = Object.entries(LINK_WORDS).find(([, list]) => hit(words, list))?.[0];
    if (kind) return claim('link', `link.${kind}`, [link, kind]);
    return claim('link', state ? null : 'link.base', [link]);
  }
  const text = family('text');
  if (text) {
    if (status || family('surface') || family('border')) return claim('text', null, [text]);
    const inverse = hit(words, RUNG_WORDS.inverse);
    if (inverse) return claim('text', 'inverse.text', [text, inverse]);
    const rung = Object.entries(RUNG_WORDS).find(([, list]) => hit(words, list));
    return claim('text', `text.${rung?.[0] ?? 'base'}`, [text, rung && hit(words, rung[1])]);
  }
  const surface = family('surface');
  if (surface) {
    const inverse = hit(words, RUNG_WORDS.inverse);
    if (inverse) return claim('surface', status || role || interaction ? null : 'inverse.surface', [surface, inverse]);
    return claim('surface', status || role || interaction ? null : 'elevation.surface', [surface]);
  }
  const border = family('border');
  if (border) return claim('border', status || role || interaction ? null : 'border.base', [border]);
  if (status) return claim('status', state ? null : `${status[0]}.solid`, [hit(words, status[1])]);
  if (role) return claim('role', state ? null : `${role[0]}.solid`, [hit(words, role[1])]);
  return null;
}

/** Read a fontFamily token's name: the font slot it names (`font.mono`), or null. */
export function readFontName(path) {
  const words = nameWords(path);
  const found = Object.entries(FONT_WORDS).find(([, list]) => hit(words, list));
  return found ? { family: 'font', slot: `font.${found[0]}`, words: [hit(words, found[1])] } : null;
}
