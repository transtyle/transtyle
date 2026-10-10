/**
 * NORMALIZE stage: canonical per-mode IR with alias resolution and provenance
 * (docs/architecture/pipeline.md#2-normalize).
 */

import { collectTokens, collectRoleArchetypes, mergeTrees, aliasTarget, comboKey, expandModeMatrix, PROVENANCE, COLOR_ROLES } from '@transtyle/ir';
import { parseValue } from './values.js';
import { isExpression, expressionRefs, evaluateExpression, ExpressionError } from './expressions.js';

/** Matches `semantic.color.<role>.solid` — the anchor cell an entire role grid
 *  (hover/active/tint/outline/on-colors, ~16 slots) fans out from. */
const ROLE_SOLID = /^semantic\.color\.([\w-]+)\.solid$/;

/**
 * @returns {{ modes: Record<string, Map<string, Entry>>, modeDimension: string }}
 * Entry = { type, value, provenance }
 * Color values are parsed to { l, c, h, alpha }; the DTCG object/array/keyword
 * forms of dimension, duration, cubicBezier and fontWeight (and the same members
 * inside composites) are canonicalized to the CSS strings exporters read, a
 * fontFamily string to its array of names (values.js); everything else is kept
 * as authored.
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
  // Where each authored key came from, for diagnostics (source locations).
  // Base layers merge into one forest and forget their files, so the file and
  // position of every key is recorded here first; a later layer overwrites an
  // earlier one, exactly as the merge does ("last wins"). Mode-scoped layers
  // are not merged, so their diagnostics read their own layer's positions.
  const sources = new Map();
  for (const layer of tokenTrees) {
    if (layer.modeScope) continue;
    for (const [p, pos] of layer.positions ?? []) sources.set(p, { file: layer.file, ...pos });
  }
  // Where a token of a Tokens Studio export came from (file, set, original
  // path), for `explain`: one map for the base, one per mode an overlay sets.
  // Last layer wins, as for values: a plain DTCG layer that redefines a token
  // after the export clears its origin.
  const origins = { base: new Map(), modes: new Map() };
  for (const layer of tokenTrees) {
    let target = origins.base;
    if (layer.modeScope) {
      const key = Object.entries(layer.modeScope).map(([d, v]) => `${d}=${v}`).join();
      if (!origins.modes.has(key)) origins.modes.set(key, new Map());
      target = origins.modes.get(key);
    }
    if (layer.origins) for (const [p, o] of layer.origins) target.set(p, o);
    else if (target.size > 0) for (const p of collectTokens(layer.tree).keys()) target.delete(p);
  }
  //
  // Explicit override layers (`"override": true | "extend"`, ADR-0009 addendum):
  // a marked layer redefines earlier layers on purpose, so its redefinitions
  // are silent (no TST1103). `true` also expects every token it defines to
  // exist already (TST1116 when it doesn't; a typo is the usual cause);
  // `"extend"` may add new tokens too. Each token remembers the layer that won
  // and the files it shadowed, for `explain`.
  const baseLayers = tokenTrees.filter((t) => !t.modeScope);
  const definedBy = new Map(); // token path -> files that defined it, in order
  const lastLayer = new Map(); // token path -> index of the layer that set it last
  const firstLayerOrphans = new Set();
  const merged = mergeTrees(
    baseLayers.map((t) => t.tree),
    (p, i) => {
      if (baseLayers[i].override) return;
      diagnostics.warn('TST1103', `Token defined more than once (last wins): ${p}`, { path: p });
    },
    (p, i) => {
      const layer = baseLayers[i];
      const earlier = definedBy.get(p) ?? [];
      // A re-set inside the same file's own tree is not possible (one object),
      // but a glob matching the same file twice is: it shadows itself, skip it.
      if (layer.override === true && earlier.length === 0) {
        if (i === 0) firstLayerOrphans.add(layer.file);
        else {
          diagnostics.warn(
            'TST1116',
            `${layer.file}: override layer defines ${p}, which no earlier layer defines`,
            {
              path: p,
              file: layer.file,
              ...(layer.positions?.get(p) ?? {}),
              hint: 'Fix the path if it is a typo, or mark the layer `"override": "extend"` when it may add tokens.',
            },
          );
        }
      }
      definedBy.set(p, [...earlier, layer.file]);
      lastLayer.set(p, i);
    },
  );
  for (const file of firstLayerOrphans) {
    diagnostics.warn(
      'TST1116',
      `${file}: override layer is the first token layer, so it has nothing to override`,
      { hint: 'List the base layer before it, or drop `"override"`; use `"override": "extend"` if it is meant to define tokens.' },
    );
  }
  const raw = collectTokens(merged);
  for (const [tokenPath, tok] of raw) {
    const files = definedBy.get(tokenPath) ?? [];
    const winner = files.at(-1);
    const shadowed = files.slice(0, -1).filter((f) => f !== winner);
    if (shadowed.length && baseLayers[lastLayer.get(tokenPath)].override) {
      tok.layer = { file: winner, overrides: shadowed };
    }
  }
  // Slots produced by a `bindings` rule (bindings.js) -> the rule's label,
  // carried on the alias's provenance so `explain` can name the rule.
  const bindingRules = new Map(tokenTrees.flatMap((t) => (t.bindingRules ? [...t.bindingRules] : [])));
  const roleArchetypes = collectRoleArchetypes(merged, diagnostics);

  // Mode-scoped layers. A layer naming one dimension feeds the same per-token
  // `modeValues` the inline form does (ADR-0009). A layer naming several
  // (`"mode": { "color-scheme": "dark", "contrast": "more" }`) is a combo layer
  // (ADR-0015): its values apply only where every named dimension has the named
  // value, and win over the one-dimension values there. That is the override
  // syntax ir.md#modes promised for a token that varies on two dimensions at
  // once, which a high-contrast palette (light and dark) or a brand with its own
  // dark value always does.
  const dimOrder = dimEntries.map(([n]) => n);
  for (const layer of tokenTrees.filter((t) => t.modeScope)) {
    const scopeEntries = Object.entries(layer.modeScope);
    if (scopeEntries.length === 0) {
      diagnostics.error('TST1110', `${layer.file}: a mode-scoped layer must name at least one dimension`, {
        hint: 'Write the dimension and value the layer is for, e.g. "mode": { "color-scheme": "dark" }, or several for one combination.',
      });
      continue;
    }
    const unknown = scopeEntries.filter(([dim, value]) => !config.modes?.[dim]?.values.includes(value));
    for (const [dim, value] of unknown) {
      diagnostics.error('TST1109', `${layer.file}: unknown mode "${dim}: ${value}" (not declared in config.modes)`);
    }
    if (unknown.length) continue;
    // The token's key in THIS layer's file: for TST1108 that is the later
    // definition, the one that wins.
    const layerAt = (tokenPath) => ({
      path: tokenPath,
      file: layer.file,
      ...(layer.positions?.get(tokenPath) ?? {}),
    });
    const combo = scopeEntries.length > 1;
    const scope = Object.fromEntries([...scopeEntries].sort((a, b) => dimOrder.indexOf(a[0]) - dimOrder.indexOf(b[0])));
    const label = Object.entries(scope).map(([d, v]) => `${d}=${v}`).join(', ');
    for (const [tokenPath, tok] of collectTokens(layer.tree)) {
      const base = raw.get(tokenPath);
      if (!base) {
        diagnostics.warn('TST1107', `${layer.file}: mode value for unknown token "${tokenPath}" (no default-mode value exists) — skipped`, layerAt(tokenPath));
        continue;
      }
      if (combo) {
        base.comboValues ??= [];
        const same = base.comboValues.find((c) => c.label === label);
        if (same && !layer.override) {
          diagnostics.warn('TST1108', `${tokenPath}: ${label} value overridden by later layer ${layer.file}`, layerAt(tokenPath));
        }
        if (same) same.value = tok.value;
        else base.comboValues.push({ scope, label, value: tok.value, originKey: scopeEntries.map(([d, v]) => `${d}=${v}`).join() });
        continue;
      }
      const [[scopeDim, scopeMode]] = scopeEntries;
      base.modeValues[scopeDim] ??= {};
      if (base.modeValues[scopeDim][scopeMode] !== undefined && !layer.override) {
        diagnostics.warn('TST1108', `${tokenPath}: ${scopeDim}=${scopeMode} value overridden by later layer ${layer.file}`, layerAt(tokenPath));
      }
      base.modeValues[scopeDim][scopeMode] = tok.value;
    }
  }

  // `autoDark` reclassifies a cross-mode carry-over's provenance (see
  // reportModeCarryOver below for the diagnostic half, and the note there on
  // why it can only be judged after aliases resolve).
  const autoDark = Boolean(config?.derivation?.autoDark);

  const combos = expandModeMatrix(dimEntries);
  const modes = {};
  const comboDims = {};
  // Tokens whose value in some combo had two one-dimension values to choose
  // from and no combo value to settle it (TST1125), keyed token + dimensions.
  const contested = new Map();
  for (const { key, values } of combos) {
    const map = new Map();
    for (const [tokenPath, tok] of raw) {
      // Per-dimension resolution, applied independently and left-to-right
      // (docs/architecture/ir.md#modes "resolved per-dimension independently").
      // A token overriding on more than one non-default dimension at once takes
      // the last dimension's value, unless a combo layer authored that exact
      // combination (ADR-0015); without one, TST1125 says which value won.
      let value = tok.value;
      let overriddenMode = null;
      let autoDarkCarried = false;
      const overrides = [];
      for (const [dimName] of dimEntries) {
        const v = values[dimName];
        if (v === dimDefaults.get(dimName).default) continue;
        const override = tok.modeValues?.[dimName]?.[v];
        if (override !== undefined) {
          value = override;
          overriddenMode = `${dimName}=${v}`;
          overrides.push({ label: overriddenMode, value: override });
        } else if (dimName === 'color-scheme' && autoDark) {
          const role = tokenPath.match(ROLE_SOLID)?.[1];
          if (role && (COLOR_ROLES.includes(role) || roleArchetypes.has(role))) autoDarkCarried = true;
        }
      }
      const comboValue = pickComboValue(tok.comboValues, values);
      if (comboValue) {
        value = comboValue.value;
        overriddenMode = comboValue.label;
        autoDarkCarried = false;
      } else if (overrides.length > 1 && new Set(overrides.map((o) => JSON.stringify(o.value))).size > 1) {
        const id = `${tokenPath}|${overrides.map((o) => o.label).join('|')}`;
        if (!contested.has(id)) contested.set(id, { tokenPath, overrides, combos: [] });
        contested.get(id).combos.push(key);
      }
      // A Tokens Studio origin is keyed like its overlay's mode scope (`dim=value`, comma-joined).
      const originKey = comboValue ? comboValue.originKey : overriddenMode;
      const origin = (originKey ? origins.modes.get(originKey) : origins.base)?.get(tokenPath);
      map.set(tokenPath, {
        type: tok.type,
        rawValue: value,
        // Token metadata (#30) is per token, not per mode: it comes from the
        // merged base layers (last definition wins, with its value), and a
        // mode-scoped layer only ever contributes values. The entry object is
        // mutated in place when its alias resolves, so these survive the
        // provenance rewrite below.
        ...(tok.description !== undefined ? { description: tok.description } : {}),
        ...(tok.deprecated ? { deprecated: tok.deprecated } : {}),
        ...(bindingRules.has(tokenPath) ? { bindingRule: bindingRules.get(tokenPath) } : {}),
        provenance: {
          kind: autoDarkCarried ? PROVENANCE.DERIVED : PROVENANCE.AUTHORED,
          mode: overriddenMode ?? key,
          ...(autoDarkCarried ? { rule: 'auto-dark-carry(constant)@standard@1' } : {}),
          ...(tok.layer ? { layer: tok.layer.file, overrides: tok.layer.overrides } : {}),
          ...(origin ? { source: origin } : {}),
        },
      });
    }
    // Resolve aliases with cycle detection, then parse values.
    for (const tokenPath of map.keys()) resolveEntry(map, tokenPath, [], diagnostics);
    modes[key] = map;
    comboDims[key] = values;
  }

  for (const { tokenPath, overrides, combos: where } of contested.values()) {
    const winner = overrides.at(-1).label;
    const names = overrides.map((o) => o.label);
    diagnostics.warn(
      'TST1125',
      `${tokenPath} has a value for ${names.slice(0, -1).join(', ')} and one for ${winner}: in ${where.join(', ')} the ${winner} value applies, because its dimension is declared later`,
      {
        path: tokenPath,
        hint: `Author the value for that combination in a mode-scoped layer naming every dimension of it, e.g. { "files": "…", "mode": { ${names.map((n) => n.replace(/^([^=]+)=(.*)$/, '"$1": "$2"')).join(', ')} } }. If ${winner}'s value is meant for every ${names[0].split('=')[0]}, nothing is wrong.`,
      },
    );
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
    sources,
  };
}

/**
 * The combo-layer value (ADR-0015) that applies to one combination: every
 * dimension the layer names has the named value there. The most specific one
 * wins (most dimensions named); on a tie, the later layer.
 */
function pickComboValue(comboValues, values) {
  let best = null;
  for (const c of comboValues ?? []) {
    const entries = Object.entries(c.scope);
    if (!entries.every(([d, v]) => values[d] === v)) continue;
    if (!best || entries.length >= Object.keys(best.scope).length) best = c;
  }
  return best;
}

/** Structural equality for resolved values (colors are `{l,c,h,alpha}`). */
const sameValue = (a, b) =>
  a === b || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

/**
 * Whether `entry` (a slot in a combination where `color-scheme` is `scheme`, a
 * non-default value) only carries over `baseline` (the same slot with
 * `color-scheme` at its default). The rule TST1204 applies, shared with the
 * completeness levels (completeness.js), which list a carried-over neutral as
 * a to-do:
 *
 * - Only a slot the user supplied (`authored` or `aliased`) can carry over;
 *   a derived one follows its inputs.
 * - An explicit per-mode value on the slot itself is a decision, however it
 *   compares, and is never second-guessed.
 * - A slot that resolved to nothing in the default mode (dangling alias
 *   TST1105, cycle TST1104, unparseable color TST1106, each reported on its
 *   own) has no value to carry over. Without this, `undefined` equals
 *   `undefined` and the note claims an unchanged colour that never existed.
 * - Otherwise it carries over when the resolved values are equal: a bound slot
 *   whose alias target has its own value in that scheme does not.
 */
export function carriesOver(entry, baseline, scheme) {
  if (!['authored', 'aliased'].includes(entry?.provenance?.kind)) return false;
  // A combo-layer value (ADR-0015) names its modes `color-scheme=dark, contrast=more`.
  if (String(entry.provenance.mode ?? '').split(', ').includes(`color-scheme=${scheme}`)) return false;
  return baseline?.value !== undefined && sameValue(entry.value, baseline.value);
}

/**
 * TST1204: a role's `.solid` anchor drives its whole grid (~16 derived slots —
 * hover/active/tint/outline/on-colors), so when the default-mode color reaches
 * a non-default `color-scheme` value unchanged, the ENTIRE grid is that scheme's
 * theme. Not an absence (TST1201/1203 cover that): a value that's present, looks
 * complete, and never changed. Documented, default behavior (`diagnostics.md`,
 * "My brand color is identical in dark mode") — `info`, not a mistake — but
 * nothing surfaced it except the docs page.
 *
 * **Runs after aliases resolve, and compares resolved values.** It used to run
 * inside NORMALIZE's per-mode loop, testing only whether the catalog slot itself
 * carried a mode override — which is false for every design system adopted the
 * way this project recommends. Carbon binds `semantic.color.danger.solid` to
 * `{semantic.color.carbon.support-error}`, and it is the *alias target* that
 * carries the dark value: the alias string is identical in both modes, so the
 * old check called it a silent carry-over while the emitted dark theme was in
 * fact a different red. Four of Carbon's seven notes were wrong that way. The
 * condition is now both halves — no per-mode value authored ON the slot (so an
 * explicit, deliberately identical dark value stays silent) AND the resolved
 * colors actually being equal.
 *
 * Reported once per (role, scheme value) regardless of how many OTHER dimensions
 * multiply the combos sharing that fact (`dark+comfortable` and `dark+compact`
 * are one carry-over, not two). Fires whether or not `autoDark` is on: autoDark
 * does not compute a distinct color for this slot (docs/exercises/
 * phase0-shadcn.md F7 — `darkBrandAdjust` is a still-open research question),
 * so the color genuinely is the carried-over one either way. What autoDark
 * changes is provenance: without it the carry-over is misclassified `authored`;
 * with it it's `derived`, so `report.json` shows synthetic dark-theme coverage
 * honestly. (That reclassification only reaches non-aliased slots — an aliased
 * carry-over stays `aliased`, which is accurate about where the value came from
 * but doesn't get autoDark's coverage honesty. Separate question, left alone.)
 */
export function reportModeCarryOver(normalized, config, diagnostics) {
  const DIM = 'color-scheme';
  const dim = normalized.dimensions?.[DIM];
  if (!dim) return;
  const autoDark = Boolean(config?.derivation?.autoDark);
  const reported = new Set();

  for (const key of normalized.allCombos) {
    const dims = normalized.comboDims[key];
    const scheme = dims[DIM];
    if (scheme === dim.default) continue;
    const map = normalized.modes[key];
    const base = normalized.modes[comboKey(normalized.dimensionNames, { ...dims, [DIM]: dim.default })];
    if (!map || !base) continue;

    for (const [tokenPath, entry] of map) {
      const role = tokenPath.match(ROLE_SOLID)?.[1];
      if (!role || !(COLOR_ROLES.includes(role) || normalized.roleArchetypes.has(role))) continue;
      // Only roles the user actually supplied. Running after DERIVE means every
      // derived role anchor (`accent.solid` aliasing primary, `danger.solid`
      // hue-anchored from it) is in the map too, and each of them carries over
      // for exactly one reason: the authored anchor did. Reporting them would
      // print eight consequences of one cause — the noise AL5 removed
      // everywhere else.
      if (!carriesOver(entry, base.get(tokenPath), scheme)) continue;

      const dedupeKey = `${tokenPath}|${scheme}`;
      if (reported.has(dedupeKey)) continue;
      reported.add(dedupeKey);
      diagnostics.info(
        'TST1204',
        `${tokenPath} has no authored value for ${DIM}=${scheme} — the ${dim.default}-mode value carries over unchanged, and so does its whole derived grid`,
        autoDark
          ? { path: tokenPath, hint: `Author ${tokenPath} for ${DIM}=${scheme} if this role should differ in that mode. \`derivation.autoDark\` is on, so this carry-over is now classified "derived" in coverage — but it does not yet compute a distinct color (that transform is still an open research question; see the roadmap).` }
          : { path: tokenPath, hint: `Author ${tokenPath} for ${DIM}=${scheme} if this role should differ in that mode. This is default behavior — nothing is broken.` },
      );
    }
  }
}

/**
 * Post-DERIVE pass: TST1113, a `semantic.*` token whose alias points straight at
 * a `component.*` token. The tiers layer option -> semantic -> component, so the
 * semantic tier is the stable surface that component tokens read from; reading
 * the other way inverts the layering and makes every exporter that binds the
 * semantic token depend on a component refinement. Tier is structural (the
 * top-level group name), so this is a prefix test, no inference.
 *
 * Only the direct edge is flagged: `semantic.a -> semantic.b -> component.c`
 * reports `semantic.b`, the token that actually points the wrong way. The
 * message does not mention the mode, so the collector's de-duplication reports
 * a token once however many mode combinations carry the same alias. An
 * unresolved alias has no `aliased` provenance and is never double-reported
 * here (TST1104/TST1105 already name it).
 */
export function reportTierViolations(normalized, diagnostics) {
  const seen = new Set();
  for (const map of Object.values(normalized.modes)) {
    if (!map || seen.has(map)) continue; // modes.light/dark alias the combo maps
    seen.add(map);
    for (const [tokenPath, entry] of map) {
      if (!tokenPath.startsWith('semantic.')) continue;
      const target = entry.provenance?.kind === 'aliased' ? entry.provenance.target : undefined;
      if (typeof target !== 'string' || !target.startsWith('component.')) continue;
      diagnostics.error(
        'TST1113',
        `${tokenPath} aliases ${target}: a semantic token cannot point into the component tier`,
        { hint: `Tiers layer option -> semantic -> component. Alias ${target}'s own source instead, or move ${tokenPath} under \`component.\`.` },
      );
    }
  }
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
    path: chain[0],
    hint: 'Break the loop: one of these tokens has to hold a literal value.',
  });
}

/** Per combo map, the tokens on an alias loop resolveEntry() has reported. */
const loopMembers = new WeakMap();

/**
 * Resolve one token in a combo map, and every alias on the way to a literal:
 * returns the entry (with `.value`), DEFERRED (the chain ends on a slot DERIVE
 * may still fill), CYCLE (already reported as TST1104), or undefined (failed,
 * already reported). `stack` is the path that led here from outside the chain,
 * i.e. the composites whose member this is; a token on it closes a cycle.
 *
 * The alias chain is walked in a loop and settled on the way back, not by one
 * recursive call per hop (issue #97). The recursive version copied the path at
 * every hop and searched it linearly, so a chain cost O(depth²) and a stack
 * frame per link: about 4,500 links overflowed the stack, and the CLI printed
 * `Maximum call stack size exceeded` with no code and no token named. Every
 * link still gets exactly what the recursion gave it: the value and an
 * `aliased` provenance, `pendingAlias` when the end is deferred, nothing on a
 * cycle, and TST1105 when the end failed, innermost link first.
 */
function resolveEntry(map, tokenPath, stack, diagnostics) {
  // A token on a loop already reported as itself: walking it again would only
  // go round the same loop, find the same member set, and report nothing (see
  // reportCycle). Skipping it keeps a long loop linear instead of one full lap
  // per member, which made a 10,000-link loop take minutes.
  if (stack.length === 0 && loopMembers.get(map)?.has(tokenPath)) return CYCLE;
  const chain = []; // the alias tokens walked, in order
  const targets = []; // targets[i] is what chain[i] points at
  const onPath = new Set(stack);
  let path = tokenPath;
  let outcome;
  for (;;) {
    const entry = map.get(path);
    if (!entry) { outcome = undefined; break; }
    if (entry.value !== undefined) { outcome = entry; break; }
    if (entry.pendingAlias || entry.pendingMembers) { outcome = DEFERRED; break; }
    if (onPath.has(path)) {
      const walked = [...stack, ...chain];
      reportCycle(diagnostics, [...walked, path]);
      // Only a walk that started on the loop reported the loop's own member
      // set; one that came in from a tail reported tail + loop, and each loop
      // member still reports the loop alone on its own walk, as before.
      if (walked[0] === path) {
        if (!loopMembers.has(map)) loopMembers.set(map, new Set());
        for (const member of walked) loopMembers.get(map).add(member);
      }
      // AL5: a distinct sentinel, not `undefined`. Returning `undefined` made the
      // caller report TST1105 "dangling alias" on top of the cycle — which is
      // false (the target exists; it just loops) and doubled the output on the
      // exact error where the chain is already printed in full.
      outcome = CYCLE;
      break;
    }
    if (isExpression(entry.rawValue)) { outcome = resolveExpression(map, entry, path, [...stack, ...chain], diagnostics); break; }
    const target = aliasTarget(entry.rawValue);
    if (!target) { outcome = resolveLiteral(map, entry, path, [...stack, ...chain], diagnostics); break; }
    chain.push(path);
    targets.push(target);
    onPath.add(path);
    // Absent target: possibly derived later — defer rather than erroring.
    // A target that IS present but failed to resolve (bad color syntax, cycle)
    // is a genuine failure now, exactly as before.
    if (!map.has(target)) { outcome = DEFERRED; break; }
    path = target;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const linkPath = chain[i];
    const target = targets[i];
    const entry = map.get(linkPath);
    if (outcome === DEFERRED) { entry.pendingAlias = target; continue; }
    if (outcome === CYCLE) continue; // already reported as TST1104
    if (!outcome) {
      diagnostics.error('TST1105', `Dangling alias in ${linkPath}: {${target}}`, {
        path: linkPath,
        hint: `Nothing resolves to "${target}". Check the tier prefix (option./semantic./component.) and the spelling.`,
      });
      continue;
    }
    settleAlias(entry, target, outcome);
    outcome = entry;
  }
  return outcome;
}

/** The end of a chain: a composite's members, or a literal parsed by its type. */
function resolveLiteral(map, entry, tokenPath, stack, diagnostics) {
  if (COMPOSITES[entry.type]) {
    const memberStack = [...stack, tokenPath];
    return resolveComposite(entry, tokenPath, diagnostics, (memberTarget) =>
      map.has(memberTarget) ? resolveEntry(map, memberTarget, memberStack, diagnostics) : DEFERRED,
    );
  }
  try {
    entry.value = parseValue(entry.type, entry.rawValue, warnAt(diagnostics, tokenPath, tokenPath));
  } catch (e) {
    diagnostics.error('TST1106', `${tokenPath}: ${e.message}`, { path: tokenPath, ...(e.hint ? { hint: e.hint } : {}) });
    return undefined;
  }
  return entry;
}

/** An alias takes its target's value, and says where it came from. */
function settleAlias(entry, target, resolved) {
  entry.type = entry.type ?? resolved.type;
  entry.value = resolved.value;
  entry.provenance = { kind: 'aliased', target, mode: entry.provenance.mode, ...layerOf(entry.provenance), ...(entry.bindingRule ? { rule: entry.bindingRule } : {}) };
}

/**
 * A Tokens Studio expression (expressions.js): resolve every reference it makes
 * for this mode, then evaluate it and parse the result by the token's type.
 * A reference to a token that doesn't exist is a dangling alias (TST1105), one
 * that only DERIVE fills can't feed math (TST1006), and a value outside the
 * supported subset is TST1006 too. Provenance stays `authored` and records the
 * expression, so `explain` shows `32px ← {option.space.base} * 2`.
 */
function resolveExpression(map, entry, tokenPath, stack, diagnostics) {
  const evaluated = evaluateWith(entry.rawValue, entry.type, tokenPath, tokenPath, diagnostics, (ref) => {
    if (!map.has(ref)) return undefined;
    return resolveEntry(map, ref, [...stack, tokenPath], diagnostics);
  });
  if (evaluated === CYCLE) return CYCLE;
  if (evaluated === DEFERRED) {
    diagnostics.error('TST1006', `${tokenPath}: "${entry.rawValue.text}" reads a slot only derivation fills, so it cannot be evaluated while tokens load`, {
      path: tokenPath,
      hint: 'Reference an authored token in the expression.',
    });
    return undefined;
  }
  if (!evaluated) return undefined;
  try {
    entry.value = entry.type === 'color' ? evaluated.value : parseValue(entry.type, evaluated.value);
  } catch (e) {
    diagnostics.error('TST1106', `${tokenPath}: ${e.message} (from "${entry.rawValue.text}")`, { path: tokenPath, ...(e.hint ? { hint: e.hint } : {}) });
    return undefined;
  }
  entry.provenance = { ...entry.provenance, expression: entry.rawValue.text };
  return entry;
}

/**
 * Resolve an expression's references through `lookup` (an entry, DEFERRED,
 * CYCLE, or undefined for a dangling one) and evaluate it. Returns
 * `{ value }`, DEFERRED, CYCLE, or undefined after reporting.
 */
function evaluateWith(expr, type, at, tokenPath, diagnostics, lookup) {
  const values = new Map();
  let deferred = false;
  for (const ref of expressionRefs(expr.text)) {
    const resolved = lookup(ref);
    if (resolved === CYCLE) return CYCLE;
    if (resolved === DEFERRED) { deferred = true; continue; }
    if (!resolved || resolved.value === undefined) {
      diagnostics.error('TST1105', `Dangling alias in ${at}: {${ref}} (in "${expr.text}")`, {
        path: tokenPath,
        hint: `Nothing resolves to "${ref}". Check the set that defines it is used by the theme, and the spelling.`,
      });
      return undefined;
    }
    values.set(ref, resolved.value);
  }
  if (deferred) return DEFERRED;
  try {
    return { value: evaluateExpression(expr.text, type, values) };
  } catch (e) {
    if (!(e instanceof ExpressionError)) throw e;
    diagnostics.error('TST1006', `${at}: cannot evaluate "${expr.text}": ${e.message}`, { path: tokenPath, hint: e.hint });
    return undefined;
  }
}

/**
 * DTCG composite types and the type of each member (DTCG format, "Composite
 * types"). A composite's `$value` is an object of sub-values, and each member
 * is a value of its own type: `shadow.color` is a color, `shadow.blur` a
 * dimension, `typography.fontSize` a dimension, and so on.
 *
 * NORMALIZE used to parse only top-level `color` tokens and pass every other
 * type through as authored. Derived composites (the elevation ladder's shadows,
 * the type roles) are built in DERIVE with their members already in IR form, so
 * nothing noticed until a design system authored one: `shadow.color` reached
 * the exporters as the string `"#00000033"`, `formatColor()` read `.l/.c/.h`
 * off a string, and css-variables shipped `oklch(NaN NaN NaN)` with no
 * diagnostic. Members are now held to the same rules as top-level tokens:
 * colors parse to OKLCH (or fail with TST1106 naming the member), aliases
 * resolve per mode — deferred to after DERIVE when they point at a slot DERIVE
 * fills, exactly like a top-level alias — and every other member goes through
 * the same per-type parsers as a top-level token (values.js), so a dimension,
 * duration, cubicBezier or fontWeight member authored in its DTCG structured
 * form becomes the CSS string too, a `typography.fontFamily` string becomes the
 * array of names, and the rest is carried as authored.
 *
 * `required` lists the members an exporter renders positionally (a box-shadow,
 * a border shorthand): a missing one would print `undefined` into a
 * stylesheet, so it is a TST1106 here instead. `typography` has none: the
 * engine's own type roles omit members whose source is absent, and every
 * consumer already reads its members by name. `layers` marks the one composite
 * DTCG lets author as an array (stacked shadows).
 */
const COMPOSITES = {
  shadow: {
    members: { color: 'color', offsetX: 'dimension', offsetY: 'dimension', blur: 'dimension', spread: 'dimension', inset: 'boolean' },
    required: ['color', 'offsetX', 'offsetY', 'blur', 'spread'],
    layers: true,
  },
  typography: {
    members: { fontFamily: 'fontFamily', fontSize: 'dimension', fontWeight: 'fontWeight', letterSpacing: 'dimension', lineHeight: 'number' },
    required: [],
  },
  border: {
    members: { color: 'color', width: 'dimension', style: 'strokeStyle' },
    required: ['color', 'width', 'style'],
  },
  transition: {
    members: { duration: 'duration', delay: 'duration', timingFunction: 'cubicBezier' },
    required: ['duration', 'delay', 'timingFunction'],
  },
};

/**
 * Parse one composite member by its DTCG member type, through the same
 * per-type parsers as a top-level token (values.js): a `shadow.color` becomes
 * OKLCH, a `blur` authored as `{ "value": 8, "unit": "px" }` or a
 * `timingFunction` authored as four numbers becomes the CSS string the
 * exporters read, exactly as the top-level token would (#24). Throws with a
 * reason, and a `hint` for the structured forms.
 */
/** Report a parser's non-fatal finding as a warning under `at` (a token, or a composite member's path). */
const warnAt = (diagnostics, at, tokenPath) => ({ code, message, hint }) =>
  diagnostics.warn(code, `${at}: ${message}`, { path: tokenPath, ...(hint ? { hint } : {}) });

function parseMember(type, value, onWarning) {
  // An alias to a color token arrives already parsed.
  if (type === 'color' && value !== null && typeof value === 'object' && ['l', 'c', 'h'].every((k) => typeof value[k] === 'number')) {
    return { ...value };
  }
  if (type === 'boolean' && typeof value !== 'boolean') {
    throw new Error(`expected true or false, got ${JSON.stringify(value)}`);
  }
  return parseValue(type, value, onWarning);
}

/**
 * Resolve a composite token's members. `lookup(target)` resolves one member
 * alias and returns its entry, DEFERRED (target not materialized yet), CYCLE,
 * or undefined (dangling) — NORMALIZE and the post-DERIVE pass differ only in
 * that function. Every bad member is reported before giving up, each under its
 * own path (`semantic.color.elevation.1.shadow.color`, or `….shadow.1.color`
 * for the second layer of a stacked shadow), so one build shows them all.
 *
 * Member aliases are recorded in `provenance.members` (member path → target)
 * for `explain`. The token itself stays `authored`: the composite is what the
 * user wrote, its members point wherever they point.
 */
function resolveComposite(entry, tokenPath, diagnostics, lookup) {
  const spec = COMPOSITES[entry.type];
  const raw = entry.rawValue;
  const layered = Array.isArray(raw);
  const shape = `a DTCG ${entry.type} object (${Object.keys(spec.members).join(', ')})`;
  if (layered && (!spec.layers || raw.length === 0)) {
    diagnostics.error(
      'TST1106',
      spec.layers
        ? `${tokenPath}: an empty ${entry.type} array — author at least one layer`
        : `${tokenPath}: expected ${shape}, got an array (only shadow composites may be authored as a list of layers)`,
      { path: tokenPath },
    );
    return undefined;
  }

  const members = {};
  let failed = false;
  let pending = false;
  let cycle = false;
  const parsed = (layered ? raw : [raw]).map((layer, i) => {
    const at = layered ? `${tokenPath}.${i}` : tokenPath;
    if (layer === null || typeof layer !== 'object' || Array.isArray(layer)) {
      diagnostics.error('TST1106', `${at}: expected ${shape}, got ${JSON.stringify(layer)}`, { path: tokenPath });
      failed = true;
      return undefined;
    }
    for (const name of spec.required) {
      if (!(name in layer)) {
        diagnostics.error('TST1106', `${at}.${name}: missing — a ${entry.type} needs ${spec.required.join(', ')}`, { path: tokenPath });
        failed = true;
      }
    }
    const out = {};
    for (const [name, authored] of Object.entries(layer)) {
      const memberPath = `${at}.${name}`;
      let value = authored;
      if (isExpression(authored)) {
        const evaluated = evaluateWith(authored, spec.members[name], memberPath, tokenPath, diagnostics, lookup);
        if (evaluated === DEFERRED) { pending = true; continue; }
        if (evaluated === CYCLE) { cycle = true; continue; }
        if (!evaluated) { failed = true; continue; }
        value = evaluated.value;
      }
      const target = aliasTarget(authored);
      if (target) {
        const resolved = lookup(target);
        if (resolved === DEFERRED) { pending = true; continue; }
        if (resolved === CYCLE) { cycle = true; continue; } // already reported as TST1104
        if (!resolved || resolved.value === undefined) {
          diagnostics.error('TST1105', `Dangling alias in ${memberPath}: {${target}}`, {
            path: tokenPath,
            hint: `Nothing resolves to "${target}" — not authored, and not produced by derivation. Check the tier prefix (option./semantic./component.) and the spelling.`,
          });
          failed = true;
          continue;
        }
        value = resolved.value;
        members[memberPath.slice(tokenPath.length + 1)] = target;
      }
      try {
        out[name] = parseMember(spec.members[name], value, warnAt(diagnostics, memberPath, tokenPath));
      } catch (e) {
        diagnostics.error('TST1106', `${memberPath}${target ? ` (via {${target}})` : ''}: ${e.message}`, { path: tokenPath, ...(e.hint ? { hint: e.hint } : {}) });
        failed = true;
      }
    }
    return out;
  });

  if (cycle) return CYCLE;
  if (failed) return undefined;
  if (pending) {
    entry.pendingMembers = true;
    return DEFERRED;
  }
  entry.value = layered ? parsed : parsed[0];
  if (Object.keys(members).length) entry.provenance = { ...entry.provenance, members };
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

/**
 * Resolve-if-ready: settle a deferred alias *now* when its target already has a
 * value, and otherwise leave it pending, silently. Returns the entry (or
 * undefined when the path doesn't exist); callers read `.value`.
 *
 * DERIVE reads its inputs through this. A deferred alias used to stay
 * `undefined` for the whole stage, even once DERIVE had filled its target, so
 * everything derived FROM it was dropped: `secondary.solid` authored as
 * `{semantic.color.info.solid}` resolved after DERIVE, but its grid (hover,
 * tint, on-colors…) was never built, and nothing said so. Reading through here,
 * a slot derived earlier in the pass is seen right away.
 *
 * Unlike resolveDeferredAliases() it never reports anything: a target that
 * doesn't exist yet may still be derived later in the pass, and only the
 * post-DERIVE pass can call it dangling (TST1105). Chains are followed (an alias
 * to an alias that is itself waiting), with a cycle guard; a cycle stays pending
 * for the post-DERIVE pass to report as TST1104. The resolved entry is exactly
 * what resolvePending() would have produced, so settling early changes no value
 * and no provenance. Whole-token aliases only: a composite waiting on a member
 * (`pendingMembers`) is still settled after DERIVE.
 */
export function resolveIfReady(map, tokenPath) {
  const first = map.get(tokenPath);
  // Walked in a loop for the same reason as resolveEntry(): a recursive call per
  // link overflowed the stack on a long chain.
  const chain = [];
  const onPath = new Set();
  let path = tokenPath;
  let end = first;
  while (end?.pendingAlias && !onPath.has(path)) {
    chain.push(path);
    onPath.add(path);
    path = end.pendingAlias;
    end = map.get(path);
  }
  if (end?.value === undefined) return first;
  for (let i = chain.length - 1; i >= 0; i--) {
    const link = map.get(chain[i]);
    settleAlias(link, link.pendingAlias, end);
    delete link.pendingAlias;
    end = link;
  }
  return first;
}

function resolvePending(map, tokenPath, stack, diagnostics) {
  // A loop over the chain, settled on the way back, like resolveEntry().
  const chain = [];
  const onPath = new Set(stack);
  let path = tokenPath;
  let outcome;
  for (;;) {
    const entry = map.get(path);
    if (!entry || !(entry.pendingAlias || entry.pendingMembers)) { outcome = entry; break; }
    if (onPath.has(path)) {
      reportCycle(diagnostics, [...stack, ...chain, path]);
      delete entry.pendingAlias;
      delete entry.pendingMembers;
      outcome = CYCLE;
      break;
    }
    if (entry.pendingMembers) {
      // A composite with a member aliasing a derived slot (`"color":
      // "{semantic.color.scrim}"`). Same rule as a whole-token alias: a target
      // that still doesn't exist is dangling now.
      const memberStack = [...stack, ...chain, path];
      outcome = resolveComposite(entry, path, diagnostics, (memberTarget) =>
        map.has(memberTarget) ? resolvePending(map, memberTarget, memberStack, diagnostics) : undefined,
      );
      delete entry.pendingMembers;
      break;
    }
    chain.push(path);
    onPath.add(path);
    if (!map.has(entry.pendingAlias)) { outcome = undefined; break; }
    path = entry.pendingAlias;
  }
  for (let i = chain.length - 1; i >= 0; i--) {
    const linkPath = chain[i];
    const entry = map.get(linkPath);
    const target = entry.pendingAlias;
    delete entry.pendingAlias;
    if (outcome === CYCLE) continue; // already reported as TST1104
    if (!outcome || outcome.value === undefined) {
      diagnostics.error('TST1105', `Dangling alias in ${linkPath}: {${target}}`, {
        path: linkPath,
        hint: `Nothing resolves to "${target}" — not authored, and not produced by derivation. Check the tier prefix (option./semantic./component.) and the spelling.`,
      });
      outcome = undefined;
      continue;
    }
    settleAlias(entry, target, outcome);
    outcome = entry;
  }
  return outcome;
}

/** The override-layer and source keys of a provenance, kept when an authored entry becomes an alias. */
const layerOf = (prov) => ({
  ...(prov.layer ? { layer: prov.layer, overrides: prov.overrides } : {}),
  ...(prov.source ? { source: prov.source } : {}),
});
