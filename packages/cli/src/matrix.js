/**
 * The slot × target consumption matrix (`transtyle check --matrix`, issue #95),
 * rendered for the terminal and grouped for the docs page.
 *
 * The matrix itself is core's: `compile()` records the catalog slots each
 * exporter reads while it emits (each target result's `reads`, also written to
 * its `report.json`), and `consumption()` from `@transtyle/core` turns a
 * compile result into `{ targets, slots }` (issue #160). This module only
 * orders and prints it.
 */

/**
 * The catalog section a slot is listed under: the role grid one role at a
 * time, then each semantic group, then each component.
 */
export function sectionOf(slot) {
  const parts = slot.split('.');
  if (parts[0] === 'component') return parts.slice(0, 2).join('.');
  if (parts[1] === 'color' && parts.length > 3) return parts.slice(0, 3).join('.');
  return parts.slice(0, 2).join('.');
}

/** The role grid in the order the language reference lists it; other roles follow, sorted. */
const ROLE_ORDER = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info', 'neutral'];

/** Colour first (the role grid, then the rest), then the other semantic groups, then components. */
function sectionKey(section) {
  const [tier, group, sub] = section.split('.');
  if (tier === 'component') return [2, 0, section];
  if (group !== 'color') return [1, 0, section];
  const role = ROLE_ORDER.indexOf(sub);
  return [0, role === -1 ? ROLE_ORDER.length : role, section];
}

/** Slots grouped by section, sections in catalog order, slots sorted: deterministic. */
export function sections(matrix) {
  const out = new Map();
  for (const slot of Object.keys(matrix.slots)) {
    const s = sectionOf(slot);
    if (!out.has(s)) out.set(s, []);
    out.get(s).push(slot);
  }
  const cmp = (a, b) => {
    const [x, y] = [sectionKey(a), sectionKey(b)];
    return x[0] - y[0] || x[1] - y[1] || (x[2] < y[2] ? -1 : x[2] > y[2] ? 1 : 0);
  };
  return new Map([...out].sort(([a], [b]) => cmp(a, b)));
}

/** Plain-text rendering for the terminal: one line per slot, readers listed. */
export function renderMatrix(matrix) {
  const lines = [];
  const n = matrix.targets.length;
  const width = Math.max(0, ...Object.keys(matrix.slots).map((s) => s.length - sectionOf(s).length - 1));
  for (const [section, slots] of sections(matrix)) {
    lines.push('', section);
    for (const slot of slots) {
      const cells = matrix.slots[slot];
      const readers = matrix.targets.filter((t) => cells[t]);
      const name = slot.slice(section.length + 1) || slot;
      const who = readers.map((t) => `${t} (${cells[t].class})`).join(', ') || '—';
      lines.push(`  ${name.padEnd(width)}  ${String(readers.length).padStart(String(n).length)}/${n}  ${who}`);
    }
  }
  return lines.join('\n').replace(/^\n/, '');
}
