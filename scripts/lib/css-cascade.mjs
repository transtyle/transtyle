/**
 * A small CSS cascade for the stylesheets Transtyle writes (check:minimal-ds,
 * issues #49 and #50): which value each custom property ends up with on
 * `<html>` (and on one descendant, such as `.btn-primary`), for a given set of
 * attributes and classes on `<html>` and a given set of media features that
 * match.
 *
 * It understands exactly the selectors the exporters emit, and fails loudly on
 * anything else: `:root`, `:where(:root)`, `.class`, `[attr]`, `[attr="v"]`,
 * `:not(<list>)`, compounds of those, one descendant step (`X .btn-primary`),
 * selector lists, and rules nested in `@media` (a list of features joined by
 * `and`) or `@layer`. `@theme`, `@plugin` and `@import` blocks are skipped.
 * Specificity is counted the CSS way: one per class, attribute or pseudo-class,
 * nothing for `:where()`, the most specific argument for `:not()`.
 */

/** Strip comments, then read the rules: [{ selector, media: string[], decls: [[name, value]] }]. */
export function parseRules(css) {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  const walk = (media, end) => {
    while (i < end) {
      const open = src.indexOf('{', i);
      if (open === -1 || open >= end) {
        i = end;
        return;
      }
      const head = src.slice(i, open).trim().replace(/^[;\s]+/, '');
      const close = matching(src, open);
      if (head.startsWith('@media')) {
        i = open + 1;
        walk([...media, ...head.slice('@media'.length).split(/\s+and\s+/).map((q) => q.trim())], close);
      } else if (head.startsWith('@layer')) {
        i = open + 1;
        walk(media, close);
      } else if (head.startsWith('@')) {
        // @theme, @plugin, @keyframes…: not selector rules.
      } else if (head) {
        const decls = [];
        for (const m of src.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]*);/g)) decls.push([m[1], m[2].trim()]);
        rules.push({ selector: head, media, decls });
      }
      i = close + 1;
    }
  };
  walk([], src.length);
  return rules;
}

function matching(src, open) {
  let depth = 0;
  for (let j = open; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}' && --depth === 0) return j;
  }
  throw new Error('unbalanced braces');
}

/** Split on top-level commas. */
function list(sel) {
  const out = [];
  let depth = 0;
  let start = 0;
  for (let j = 0; j < sel.length; j++) {
    if ('(['.includes(sel[j])) depth++;
    else if (')]'.includes(sel[j])) depth--;
    else if (sel[j] === ',' && depth === 0) {
      out.push(sel.slice(start, j).trim());
      start = j + 1;
    }
  }
  out.push(sel.slice(start).trim());
  return out;
}

/** Split a compound selector into its simple parts. */
function simples(compound) {
  const out = [];
  let j = 0;
  while (j < compound.length) {
    const ch = compound[j];
    if (ch === '[') {
      const k = compound.indexOf(']', j);
      out.push(compound.slice(j, k + 1));
      j = k + 1;
    } else if (ch === '.') {
      const m = /^\.[\w-]+/.exec(compound.slice(j));
      out.push(m[0]);
      j += m[0].length;
    } else if (ch === ':') {
      const m = /^:[\w-]+/.exec(compound.slice(j));
      let k = j + m[0].length;
      if (compound[k] === '(') {
        let depth = 0;
        for (; k < compound.length; k++) {
          if (compound[k] === '(') depth++;
          else if (compound[k] === ')' && --depth === 0) break;
        }
        k++;
      }
      out.push(compound.slice(j, k));
      j = k;
    } else {
      throw new Error(`css-cascade: unsupported selector part in "${compound}"`);
    }
  }
  return out;
}

/** Does `compound` match `el` ({ root, attrs, classes })? Returns its specificity, or -1. */
function matchCompound(compound, el) {
  let spec = 0;
  for (const s of simples(compound)) {
    if (s === ':root') {
      if (!el.root) return -1;
      spec++;
    } else if (s === ':where(:root)') {
      if (!el.root) return -1;
    } else if (s.startsWith(':not(')) {
      const inner = list(s.slice(5, -1));
      const specs = inner.map((x) => matchCompound(x, el));
      if (specs.some((x) => x >= 0)) return -1;
      spec += Math.max(...inner.map((x) => specificity(x)));
    } else if (s.startsWith('.')) {
      if (!el.classes.includes(s.slice(1))) return -1;
      spec++;
    } else if (s.startsWith('[')) {
      const m = /^\[([\w-]+)(?:="([^"]*)")?\]$/.exec(s);
      if (!m) throw new Error(`css-cascade: unsupported attribute selector ${s}`);
      if (!(m[1] in el.attrs)) return -1;
      if (m[2] !== undefined && el.attrs[m[1]] !== m[2]) return -1;
      spec++;
    } else {
      throw new Error(`css-cascade: unsupported selector part ${s}`);
    }
  }
  return spec;
}

function specificity(compound) {
  let spec = 0;
  for (const s of simples(compound)) {
    if (s === ':where(:root)') continue;
    if (s.startsWith(':not(')) spec += Math.max(...list(s.slice(5, -1)).map(specificity));
    else spec++;
  }
  return spec;
}

/**
 * The value each custom property ends up with on `<html>` (`target` omitted)
 * or on a child of it carrying `target` (`'.btn-primary'`), as a Map. `html`
 * is `{ attrs: { 'data-x': 'v' }, classes: [] }`; `features` the media
 * features that match (`'(prefers-contrast: more)'`).
 */
export function computed(rules, { attrs = {}, classes = [] } = {}, features = [], target) {
  const root = { root: true, attrs, classes };
  const child = target ? { root: false, attrs: {}, classes: [target.replace(/^\./, '')] } : null;
  const won = new Map();
  rules.forEach((rule, order) => {
    if (!rule.media.every((q) => features.includes(q))) return;
    let best = -1;
    for (const item of list(rule.selector)) {
      const parts = item.split(/\s+/);
      if (parts.length > 2) throw new Error(`css-cascade: unsupported selector ${item}`);
      if (!target && parts.length === 1) best = Math.max(best, matchCompound(parts[0], root));
      if (target && parts.length === 2) {
        const a = matchCompound(parts[0], root);
        const b = matchCompound(parts[1], child);
        if (a >= 0 && b >= 0) best = Math.max(best, a + b);
      }
      if (target && parts.length === 1) {
        const b = matchCompound(parts[0], child);
        if (b >= 0) best = Math.max(best, b);
      }
    }
    if (best < 0) return;
    for (const [name, value] of rule.decls) {
      const prev = won.get(name);
      if (!prev || best > prev.spec || (best === prev.spec && order >= prev.order)) won.set(name, { spec: best, order, value });
    }
  });
  return new Map([...won].map(([k, v]) => [k, v.value]));
}
