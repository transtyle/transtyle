/**
 * NORMALIZE stage: canonical per-mode IR with alias resolution and provenance
 * (docs/architecture/pipeline.md#2-normalize).
 */

import { collectTokens, collectRoleArchetypes, mergeTrees, aliasTarget, PROVENANCE } from '@transtyle/ir';
import { parseColor } from './color.js';

/**
 * @returns {{ modes: Record<string, Map<string, Entry>>, modeDimension: string }}
 * Entry = { type, value, provenance }
 * Color values are parsed to { l, c, h, alpha }; other types kept as authored.
 */
export function normalize(tokenTrees, config, diagnostics) {
  const modeDims = Object.entries(config.modes ?? {});
  if (modeDims.length > 1) throw new Error('Skeleton supports a single mode dimension.');
  const [dimName, dim] = modeDims[0] ?? ['color-scheme', { values: ['light'], default: 'light' }];

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

  const modes = {};
  for (const mode of dim.values) {
    const map = new Map();
    for (const [tokenPath, tok] of raw) {
      const modeOverride = mode === dim.default ? undefined : tok.modeValues?.[dimName]?.[mode];
      map.set(tokenPath, {
        type: tok.type,
        rawValue: modeOverride ?? tok.value,
        provenance: { kind: PROVENANCE.AUTHORED, mode: modeOverride !== undefined ? mode : dim.default },
      });
    }
    // Resolve aliases with cycle detection, then parse values.
    for (const tokenPath of map.keys()) resolveEntry(map, tokenPath, [], diagnostics);
    modes[mode] = map;
  }
  return { modes, modeDimension: dimName, defaultMode: dim.default, modeValues: dim.values, roleArchetypes };
}

function resolveEntry(map, tokenPath, stack, diagnostics) {
  const entry = map.get(tokenPath);
  if (!entry) return undefined;
  if (entry.value !== undefined) return entry;
  if (stack.includes(tokenPath)) {
    diagnostics.error('TST1104', `Alias cycle: ${[...stack, tokenPath].join(' → ')}`);
    return undefined;
  }
  let raw = entry.rawValue;
  const target = aliasTarget(raw);
  if (target) {
    const resolved = resolveEntry(map, target, [...stack, tokenPath], diagnostics);
    if (!resolved) {
      diagnostics.error('TST1105', `Dangling alias in ${tokenPath}: {${target}}`);
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
