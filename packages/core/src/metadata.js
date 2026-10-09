/**
 * Token metadata past NORMALIZE (#30): DTCG `$description` and `$deprecated`
 * reach the diagnostics (TST1122), every target's `report.json` items and
 * `usage.md`. NORMALIZE puts both on the entries (`entry.description`,
 * `entry.deprecated`: `true` or the reason); exporters write descriptions into
 * the files that take comments themselves (`entryNotes()` in @transtyle/ir).
 */

const CATALOG_TIERS = ['semantic.', 'component.'];

/**
 * Every deprecated token a slot's value comes through, in chain order: the
 * slot itself, each hop of its alias chain, and the chains of its composite
 * members (`provenance.members`). Derived inputs are not followed: a derived
 * slot's anchor reports its own deprecation. Returns `[{ token, reason }]`,
 * `reason` being the `$deprecated` string or `undefined` for `true`.
 */
export function deprecationsReached(map, slot) {
  const out = [];
  const seen = new Set();
  // Depth first, the alias target before the members, with an explicit stack:
  // a recursive call per hop overflowed on a chain of a few thousand aliases
  // (#97). Children are pushed in reverse so they are visited in order.
  const stack = [slot];
  while (stack.length) {
    const p = stack.pop();
    if (seen.has(p)) continue;
    seen.add(p);
    const entry = map.get(p);
    if (!entry) continue;
    if (entry.deprecated) out.push({ token: p, reason: typeof entry.deprecated === 'string' ? entry.deprecated : undefined });
    const prov = entry.provenance ?? {};
    const next = [];
    if (prov.kind === 'aliased' && typeof prov.target === 'string') next.push(prov.target);
    next.push(...Object.values(prov.members ?? {}));
    for (let i = next.length - 1; i >= 0; i--) stack.push(next[i]);
  }
  return out;
}

/**
 * Whether any token of `map` is deprecated. Without one, no slot reaches one,
 * so the callers below skip the walk per slot: on a long alias chain that walk
 * is the length of the chain for every slot on it, and most design systems
 * deprecate nothing (#97).
 */
function hasDeprecated(map) {
  for (const entry of map.values()) if (entry?.deprecated) return true;
  return false;
}

/**
 * TST1122 (warning): a catalog slot (`semantic.*`, `component.*`) whose value
 * reaches a deprecated token, so the deprecated token still compiles into
 * every target that reads the slot. Judged after the deferred aliases resolve,
 * across every mode combo (a chain can differ per mode), and reported once per
 * (slot, deprecated token): the message names no mode, so the collector's
 * de-duplication folds the combos. A deprecated `option.*` token that no slot
 * reaches stays silent: deprecating it is the first step of removing it.
 */
export function reportDeprecatedReach(normalized, diagnostics) {
  const seen = new Set();
  for (const map of Object.values(normalized.modes)) {
    if (!map || seen.has(map)) continue; // modes.light/dark alias the combo maps
    seen.add(map);
    if (!hasDeprecated(map)) continue;
    for (const slot of map.keys()) {
      if (!CATALOG_TIERS.some((t) => slot.startsWith(t))) continue;
      for (const { token, reason } of deprecationsReached(map, slot)) {
        const self = token === slot;
        diagnostics.warn(
          'TST1122',
          self
            ? `${slot} is deprecated and still compiles into every target that reads it`
            : `${slot} takes its value from deprecated token ${token}`,
          {
            path: slot,
            hint: reason
              ? `${self ? '' : `${token}: `}${firstLine(reason)}`
              : self
                ? 'Move what reads it to its replacement, then remove it.'
                : `Point ${slot} at the replacement, or remove the binding.`,
          },
        );
      }
    }
  }
}

/**
 * `report.json` coverage items with the metadata of the slot they map, read
 * from the default mode: `description` (the slot's own), and `deprecated` (the
 * reason, or `true`) with `deprecatedBy` (the token) when the slot or a token
 * its value comes through is deprecated. Items whose `slot` is not a slot path
 * (`—`, notes) are returned as they are.
 */
export function withMetadata(items, map) {
  if (!map) return items;
  const deprecated = hasDeprecated(map);
  return items.map((item) => {
    const entry = typeof item.slot === 'string' ? map.get(item.slot) : undefined;
    if (!entry) return item;
    const [dep] = deprecated ? deprecationsReached(map, item.slot) : [];
    if (entry.description === undefined && !dep) return item;
    return {
      ...item,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(dep ? { deprecated: dep.reason ?? true, deprecatedBy: dep.token } : {}),
    };
  });
}

const EMITTED = new Set(['native', 'derived', 'approximated']);

/**
 * Appends a "Deprecated tokens" section to a target's `usage.md` listing every
 * variable it emits whose value still comes from a deprecated token (one row
 * per variable and token), so whoever ships the theme sees what to migrate
 * before the token goes. Unchanged when nothing deprecated feeds the target.
 */
export function withDeprecatedSection(contents, items, map) {
  if (!map || !hasDeprecated(map)) return contents;
  const rows = [];
  const seen = new Set();
  for (const item of items) {
    if (!EMITTED.has(item.class) || typeof item.slot !== 'string' || !map.has(item.slot)) continue;
    for (const { token, reason } of deprecationsReached(map, item.slot)) {
      const key = `${item.variable}|${token}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push(`| \`${cell(item.variable)}\` | \`${cell(item.slot)}\` | \`${cell(token)}\` | ${reason ? cell(firstLine(reason)) : '—'} |`);
    }
  }
  if (rows.length === 0) return contents;
  return (
    contents.replace(/\n*$/, '\n') +
    `\n## Deprecated tokens\n\nThese variables still take their value from a token marked \`$deprecated\` in the design system. They keep working until the token is removed: move what reads them to the replacement the note names.\n\n| Variable | Slot | Deprecated token | Note |\n| --- | --- | --- | --- |\n${rows.join('\n')}\n`
  );
}

const firstLine = (s) => String(s).split(/\r\n|\r|\n/).map((l) => l.trim()).find((l) => l !== '') ?? '';
/** Text safe inside a Markdown table cell (and inside backticks). */
const cell = (s) => String(s).replace(/\r\n|\r|\n/g, ' ').replace(/\|/g, '\\|').replace(/`/g, "'");
