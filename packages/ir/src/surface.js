/**
 * Surface classification shared by the exporters whose target's theming
 * surface is a graph: entries that read other entries (Mantine's CSS
 * variables computed from its theme object, Chakra's semantic tokens and
 * recipes reading its tokens). docs/specs/validation-and-coverage.md, "AL3".
 *
 * Each exporter extracts its target's surface into a checked-in
 * `surface-inventory.json` whose entries carry `{ id, block, from? }`:
 * `block` is the entry's family, `from` the entries its value is read or
 * computed from. Against what the exporter emitted, an entry is one of three
 * things:
 *
 *   set     — the exporter writes it.
 *   follows — not written, but everything in its `from` is set or follows in
 *             turn, so the target derives it from this theme.
 *   default — something it reads stays the target's, so it keeps the
 *             target's value. Every one gets a reason from the exporter.
 *
 * `surfaceRows()` turns that into report.json rows in the one shape
 * scripts/check-coverage-bar.mjs reconciles for every such target: a summary
 * row per family whose three counts add up to the family's size, and a named
 * row per entry on the target's default with its reason. A family listed in
 * `derived` (Chakra's recipes: thousands of leaves, each on the default only
 * because a token it reads is) gets the summary row alone; its defaults are
 * explained by the named rows of what they read.
 */

/** A family summary row's `variable`: `theme.* (73 entries)`. */
export const SURFACE_FAMILY_ROW = /^(\w+)\.\* \((\d+) entries\)$/;

/** Parse a family or totals row's `slot`: `106 set · 66 follow · 31 on Mantine's default`. */
export function surfaceCounts(slot) {
  const m = /^(\d+) set · (\d+) follow · (\d+) on (.+)'s default$/.exec(slot ?? '');
  return m ? { set: Number(m[1]), follow: Number(m[2]), kept: Number(m[3]), target: m[4] } : null;
}

/**
 * Status of every inventory entry: `Map<id, 'set' | 'follows' | 'default'>`.
 * `isSet(entry)` says whether the exporter writes it. An entry in a `from`
 * cycle, or whose `from` names an id the inventory does not have, is default.
 */
export function surfaceStatus(entries, isSet) {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const status = new Map();
  const statusOf = (id, seen = new Set()) => {
    if (status.has(id)) return status.get(id);
    const entry = byId.get(id);
    let s = 'default';
    if (!entry) return s;
    if (isSet(entry)) s = 'set';
    else if (entry.from?.length && !seen.has(id)) {
      seen.add(id);
      if (entry.from.every((dep) => statusOf(dep, seen) !== 'default')) s = 'follows';
    }
    status.set(id, s);
    return s;
  };
  for (const entry of entries) statusOf(entry.id);
  return status;
}

/**
 * report.json rows for a classified surface. `classified` is
 * `[{ entry, status, reason }]` in inventory order, `reason` set on the
 * default entries of named families: `{ cls, note, slot?, meaning? }`.
 * `target` names the target in the rows ("Mantine"), `source` the package
 * the inventory was extracted from ("@mantine/core 9.7.1").
 */
export function surfaceRows({ classified, families, target, source, derived = [] }) {
  const rows = [];
  const totals = { set: 0, follows: 0, default: 0 };
  const onDefault = `on ${target}'s default`;
  for (const family of families) {
    const members = classified.filter((c) => c.entry.block === family);
    const n = { set: 0, follows: 0, default: 0 };
    for (const c of members) n[c.status]++;
    for (const k of Object.keys(totals)) totals[k] += n[k];
    const isDerived = derived.includes(family);
    rows.push({
      variable: `${family}.* (${members.length} entries)`,
      slot: `${n.set} set · ${n.follows} follow · ${n.default} ${onDefault}`,
      class: n.set ? 'native' : n.follows > n.default ? 'derived' : 'unsupported',
      note: !n.default
        ? 'every entry is set by this theme or follows it'
        : isDerived
          ? `${n.default === 1 ? '1 entry keeps' : `${n.default} entries keep`} ${target}'s value because something ${n.default === 1 ? 'it reads' : 'they read'} does, and that has its own row with the reason`
          : n.default === 1
            ? `1 entry keeps ${target}'s value, on its own row with the reason`
            : `${n.default} entries keep ${target}'s value, each on its own row with the reason`,
    });
    if (isDerived) continue;
    for (const c of members) {
      if (c.status !== 'default') continue;
      const { reason } = c;
      rows.push({
        variable: c.entry.id,
        slot: reason?.slot ?? '—',
        class: reason?.cls ?? 'unsupported',
        ...(reason?.meaning ? { meaning: reason.meaning } : {}),
        ...(reason ? { note: reason.note } : {}),
      });
    }
  }
  rows.push({
    variable: `${target} surface totals`,
    slot: `${totals.set} set · ${totals.follows} follow · ${totals.default} ${onDefault}`,
    class: 'derived',
    note: `measured against surface-inventory.json (${source}); AL3 bar: every entry classified, no silent gap`,
  });
  return rows;
}
