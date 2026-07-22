/**
 * Semantic diff of two resolved IRs (docs/specs/diff.md, ROADMAP P6). Pure and
 * deterministic: no I/O, no git — the CLI resolves "before" (a git ref) and
 * "after" (the working tree) via compile() and hands both here.
 *
 * The unit of a design-system change is a **semantic slot value in a mode**, not
 * a token-file line: renaming an option token or restructuring layers that leaves
 * every resolved value identical is correctly reported as no change, because the
 * compiled themes are identical. That is the whole point of diffing the resolved
 * graph rather than the source.
 */

/** Canonical, stable string form of a resolved value, for equality only. */
function canon(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== 'object') return String(value);
  if (Array.isArray(value)) return `[${value.map(canon).join(',')}]`;
  // plain data objects (color components, typography/shadow composites) — sort
  // keys so equality is independent of construction order.
  return `{${Object.keys(value).sort().map((k) => `${k}:${canon(value[k])}`).join(',')}}`;
}

const provKind = (entry) => entry?.provenance?.kind ?? null;

/**
 * @returns {{ modes: Array<{ mode, added: string[], removed: string[],
 *   changed: Array<{ slot, before, after, valueChanged, provChanged }> }>,
 *   changedSlots: Set<string>, hasChanges: boolean }}
 */
export function diffResolved(before, after) {
  const modeNames = [...new Set([...Object.keys(before.modes), ...Object.keys(after.modes)])].sort();
  const modes = [];
  const changedSlots = new Set();

  for (const mode of modeNames) {
    const b = before.modes[mode] ?? new Map();
    const a = after.modes[mode] ?? new Map();
    const slots = [...new Set([...b.keys(), ...a.keys()])].sort();
    const added = [], removed = [], changed = [];

    for (const slot of slots) {
      const be = b.get(slot);
      const ae = a.get(slot);
      if (!be && ae) { added.push(slot); changedSlots.add(slot); continue; }
      if (be && !ae) { removed.push(slot); changedSlots.add(slot); continue; }
      const valueChanged = canon(be.value) !== canon(ae.value);
      const provChanged = provKind(be) !== provKind(ae);
      if (valueChanged || provChanged) {
        changed.push({ slot, before: be, after: ae, valueChanged, provChanged });
        changedSlots.add(slot);
      }
    }
    modes.push({ mode, added, removed, changed });
  }

  const hasChanges = modes.some((m) => m.added.length || m.removed.length || m.changed.length);
  return { modes, changedSlots, hasChanges };
}
