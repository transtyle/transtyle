/**
 * NORMALIZE stage: canonical per-mode IR with alias resolution and provenance
 * (docs/architecture/pipeline.md#2-normalize).
 */

import { collectTokens, collectRoleArchetypes, mergeTrees, aliasTarget, comboKey, expandModeMatrix, PROVENANCE } from '@transtyle/ir';
import { parseColor } from './color.js';

/**
 * @returns {{ modes: Record<string, Map<string, Entry>>, modeDimension: string }}
 * Entry = { type, value, provenance }
 * Color values are parsed to { l, c, h, alpha }; other types kept as authored.
 *
 * Multi-dimension modes (T8, docs/architecture/ir.md#modes): every configured
 * dimension is resolved independently, then combos are the cross-product,
 * keyed `dim1val+dim2val+...` (dimension-declaration order). Most exporters
 * only know about the *first* declared dimension (conventionally
 * `color-scheme`) — they've always read `normalized.modes.light`/`.dark`, so
 * those single-dimension-value keys stay as aliases into the combo whose
 * every OTHER dimension sits at its own default. This is the whole back-compat
 * story: a single-dimension config (today's Acme/Cathode) degenerates to
 * exactly the old behavior (combo keys equal old mode names 1:1).
 */
export function normalize(tokenTrees, config, diagnostics) {
  const dimEntries = Object.entries(config.modes ?? {});
  if (dimEntries.length === 0) dimEntries.push(['color-scheme', { values: ['light'], default: 'light' }]);
  const dimDefaults = new Map(dimEntries);
  const primaryDimName = dimEntries[0][0];

  // AL5 mode-shape sweep: the FIRST dimension is the polarity axis — derive.js
  // reads dark/light off it (`isDark` keys on `modeDimension`), and exporters
  // bind the `modes.light`/`modes.dark` aliases, which only exist for the
  // primary dimension's values. So `color-scheme` declared anywhere but first
  // silently drops dark mode: the authored dark values still land in their
  // combos, but no exporter can reach them, and nothing warned. Found by
  // compiling a density-first config against every exporter — all emitted a
  // dark block filled with light values.
  //
  // This is an ERROR, not a warning: the output is guaranteed wrong (a dark
  // block filled with light values), and a warning ships that under the default
  // `failOn: error`. There is no coherent "make it work" fix — even a corrected
  // alias would leave `isDark` false for a non-primary color-scheme, so derived
  // dark values compute as light. Reordering `modes` is the only fix, so the
  // build must stop. Gated on `color-scheme` carrying more than one value: with
  // a single value there is no non-default scheme to drop, so nothing is wrong
  // and erroring would be a false failure.
  if (
    dimEntries.length > 1 &&
    dimDefaults.has('color-scheme') &&
    dimDefaults.get('color-scheme').values.length > 1 &&
    primaryDimName !== 'color-scheme'
  ) {
    diagnostics.error(
      'TST1112',
      `"color-scheme" is declared but "${primaryDimName}" is the first mode dimension — light/dark is bound to the first dimension, so this design system's dark mode will not reach any exporter.`,
      { hint: 'List "color-scheme" first in `modes`. Only the first dimension carries light/dark polarity; the others are extra axes exporters mostly drop.' },
    );
  }

  // Base layers merge into the token forest; mode-scoped layers inject values
  // into the same modeValues structure that inline $extensions produce — the
  // two authoring forms are equivalent by construction (ADR-0009).
  const merged = mergeTrees(
    tokenTrees.filter((t) => !t.modeScope).map((t) => t.tree),
    (p) => diagnostics.warn('TST1103', `Token defined more than once (last wins): ${p}`),
  );
  const raw = collectTokens(merged);
  const roleArchetypes = collectRoleArchetypes(merged, diagnostics);

  for (const layer of tokenTrees.filter((t) => t.modeScope)) {
    const scopeEntries = Object.entries(layer.modeScope);
    if (scopeEntries.length !== 1) {
      diagnostics.error('TST1110', `${layer.file}: a mode-scoped layer must target exactly one dimension`);
      continue;
    }
    const [scopeDim, scopeMode] = scopeEntries[0];
    if (!config.modes?.[scopeDim]?.values.includes(scopeMode)) {
      diagnostics.error('TST1109', `${layer.file}: unknown mode "${scopeDim}: ${scopeMode}" (not declared in config.modes)`);
      continue;
    }
    for (const [tokenPath, tok] of collectTokens(layer.tree)) {
      const base = raw.get(tokenPath);
      if (!base) {
        diagnostics.warn('TST1107', `${layer.file}: mode value for unknown token "${tokenPath}" (no default-mode value exists) — skipped`);
        continue;
      }
      base.modeValues[scopeDim] ??= {};
      if (base.modeValues[scopeDim][scopeMode] !== undefined) {
        diagnostics.warn('TST1108', `${tokenPath}: ${scopeDim}=${scopeMode} value overridden by later layer ${layer.file}`);
      }
      base.modeValues[scopeDim][scopeMode] = tok.value;
    }
  }

  const combos = expandModeMatrix(dimEntries);
  const modes = {};
  const comboDims = {};
  for (const { key, values } of combos) {
    const map = new Map();
    for (const [tokenPath, tok] of raw) {
      // Per-dimension resolution, applied independently and left-to-right
      // (docs/architecture/ir.md#modes "resolved per-dimension independently"):
      // a token overriding on more than one non-default dimension at once is
      // the rare pathological pair the spec defers; last dimension wins there.
      let value = tok.value;
      let overriddenMode = null;
      for (const [dimName] of dimEntries) {
        const v = values[dimName];
        if (v === dimDefaults.get(dimName).default) continue;
        const override = tok.modeValues?.[dimName]?.[v];
        if (override !== undefined) { value = override; overriddenMode = `${dimName}=${v}`; }
      }
      map.set(tokenPath, {
        type: tok.type,
        rawValue: value,
        provenance: { kind: PROVENANCE.AUTHORED, mode: overriddenMode ?? key },
      });
    }
    // Resolve aliases with cycle detection, then parse values.
    for (const tokenPath of map.keys()) resolveEntry(map, tokenPath, [], diagnostics);
    modes[key] = map;
    comboDims[key] = values;
  }

  // Back-compat aliases: `modes.light` / `modes.dark` (or whatever the first
  // dimension's values are) point at the combo where every OTHER dimension
  // sits at ITS OWN default — exactly what every pre-T8 exporter means.
  const otherDefaults = Object.fromEntries(dimEntries.slice(1).map(([n, d]) => [n, d.default]));
  const dimNames = dimEntries.map(([n]) => n);
  for (const v of dimDefaults.get(primaryDimName).values) {
    modes[v] = modes[comboKey(dimNames, { [primaryDimName]: v, ...otherDefaults })];
  }

  return {
    modes,
    modeDimension: primaryDimName,
    defaultMode: dimDefaults.get(primaryDimName).default,
    modeValues: dimDefaults.get(primaryDimName).values,
    dimensions: Object.fromEntries(dimEntries),
    dimensionNames: dimNames,
    comboDims,
    allCombos: combos.map((c) => c.key),
    roleArchetypes,
  };
}

/**
 * An alias whose target isn't in the map *yet*. Catalog slots the DERIVE stage
 * materializes (`radius.full`, the role grid, the elevation ladder) don't exist
 * at NORMALIZE time, so authoring `{semantic.radius.full}` — the very style
 * ir.md's component-layer sketch uses — must not be judged dangling here.
 * These entries are re-resolved by resolveDeferredAliases() after DERIVE; only
 * then, if the target still doesn't exist, is it a real dangling alias.
 */
const DEFERRED = Symbol('deferred-alias');
/** Resolution failed because of an alias cycle, already reported as TST1104. */
const CYCLE = Symbol('alias-cycle');

/**
 * Report one cycle once (AL5). The resolver reaches a two-token loop from both
 * ends, so the same cycle was printed twice with the chain rotated — two
 * different message strings describing one mistake, which de-duplication by
 * message cannot catch. Keying on the sorted member set makes any rotation of
 * the same loop a single report; the chain is still printed in traversal order,
 * because that is what shows the user how the loop closes.
 */
const reportedCycles = new WeakMap();
function reportCycle(diagnostics, chain) {
  let seen = reportedCycles.get(diagnostics);
  if (!seen) reportedCycles.set(diagnostics, (seen = new Set()));
  const key = [...new Set(chain)].sort().join('|');
  if (seen.has(key)) return;
  seen.add(key);
  diagnostics.error('TST1104', `Alias cycle: ${chain.join(' → ')}`, {
    hint: 'Break the loop: one of these tokens has to hold a literal value.',
  });
}

function resolveEntry(map, tokenPath, stack, diagnostics) {
  const entry = map.get(tokenPath);
  if (!entry) return undefined;
  if (entry.value !== undefined) return entry;
  if (entry.pendingAlias) return DEFERRED;
  if (stack.includes(tokenPath)) {
    reportCycle(diagnostics, [...stack, tokenPath]);
    // AL5: a distinct sentinel, not `undefined`. Returning `undefined` made the
    // caller report TST1105 "dangling alias" on top of the cycle — which is
    // false (the target exists; it just loops) and doubled the output on the
    // exact error where the chain is already printed in full.
    return CYCLE;
  }
  let raw = entry.rawValue;
  const target = aliasTarget(raw);
  if (target) {
    // Absent target: possibly derived later — defer rather than erroring.
    // A target that IS present but failed to resolve (bad color syntax, cycle)
    // is a genuine failure now, exactly as before.
    if (!map.has(target)) {
      entry.pendingAlias = target;
      return DEFERRED;
    }
    const resolved = resolveEntry(map, target, [...stack, tokenPath], diagnostics);
    if (resolved === DEFERRED) {
      entry.pendingAlias = target;
      return DEFERRED;
    }
    if (resolved === CYCLE) return CYCLE; // already reported as TST1104
    if (!resolved) {
      diagnostics.error('TST1105', `Dangling alias in ${tokenPath}: {${target}}`, {
        hint: `Nothing resolves to "${target}". Check the tier prefix (option./semantic./component.) and the spelling.`,
      });
      return undefined;
    }
    entry.type = entry.type ?? resolved.type;
    entry.value = resolved.value;
    entry.provenance = { kind: 'aliased', target, mode: entry.provenance.mode };
    return entry;
  }
  try {
    entry.value = entry.type === 'color' ? parseColor(raw) : raw;
  } catch (e) {
    diagnostics.error('TST1106', `${tokenPath}: ${e.message}`);
    return undefined;
  }
  return entry;
}

/**
 * Post-DERIVE pass: resolve every alias deferred at NORMALIZE time, now that
 * the derived catalog slots exist. Still-missing targets are the real dangling
 * aliases and get TST1105 here — same code, same message, just diagnosed after
 * the stage that could legitimately have supplied the target.
 */
export function resolveDeferredAliases(normalized, diagnostics) {
  const seen = new Set();
  for (const map of Object.values(normalized.modes)) {
    if (!map || seen.has(map)) continue; // modes.light/dark alias the combo maps
    seen.add(map);
    for (const tokenPath of [...map.keys()]) resolvePending(map, tokenPath, [], diagnostics);
  }
}

function resolvePending(map, tokenPath, stack, diagnostics) {
  const entry = map.get(tokenPath);
  if (!entry || !entry.pendingAlias) return entry;
  if (stack.includes(tokenPath)) {
    reportCycle(diagnostics, [...stack, tokenPath]);
    delete entry.pendingAlias;
    return CYCLE;
  }
  const target = entry.pendingAlias;
  const resolved = map.has(target)
    ? resolvePending(map, target, [...stack, tokenPath], diagnostics)
    : undefined;
  delete entry.pendingAlias;
  if (resolved === CYCLE) return CYCLE; // already reported as TST1104
  if (!resolved || resolved.value === undefined) {
    diagnostics.error('TST1105', `Dangling alias in ${tokenPath}: {${target}}`, {
      hint: `Nothing resolves to "${target}" — not authored, and not produced by derivation. Check the tier prefix (option./semantic./component.) and the spelling.`,
    });
    return undefined;
  }
  entry.type = entry.type ?? resolved.type;
  entry.value = resolved.value;
  entry.provenance = { kind: 'aliased', target, mode: entry.provenance.mode };
  return entry;
}
