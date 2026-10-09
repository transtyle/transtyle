/**
 * NORMALIZE stage: canonical per-mode IR with alias resolution and provenance
 * (docs/architecture/pipeline.md#2-normalize).
 */

import { collectTokens, collectRoleArchetypes, mergeTrees, aliasTarget, comboKey, expandModeMatrix, PROVENANCE, COLOR_ROLES } from '@transtyle/ir';
import { parseValue } from './values.js';

/** Matches `semantic.color.<role>.solid` — the anchor cell an entire role grid
 *  (hover/active/tint/outline/on-colors, ~16 slots) fans out from. */
const ROLE_SOLID = /^semantic\.color\.([\w-]+)\.solid$/;

/**
 * @returns {{ modes: Record<string, Map<string, Entry>>, modeDimension: string }}
 * Entry = { type, value, provenance }
 * Color values are parsed to { l, c, h, alpha }; the DTCG object/array/keyword
 * forms of dimension, duration, cubicBezier and fontWeight (and the same members
 * inside composites) are canonicalized to the CSS strings exporters read
 * (values.js); everything else is kept as authored.
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

  // `autoDark` reclassifies a cross-mode carry-over's provenance (see
  // reportModeCarryOver below for the diagnostic half, and the note there on
  // why it can only be judged after aliases resolve).
  const autoDark = Boolean(config?.derivation?.autoDark);

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
      let autoDarkCarried = false;
      for (const [dimName] of dimEntries) {
        const v = values[dimName];
        if (v === dimDefaults.get(dimName).default) continue;
        const override = tok.modeValues?.[dimName]?.[v];
        if (override !== undefined) { value = override; overriddenMode = `${dimName}=${v}`; }
        else if (dimName === 'color-scheme' && autoDark) {
          const role = tokenPath.match(ROLE_SOLID)?.[1];
          if (role && (COLOR_ROLES.includes(role) || roleArchetypes.has(role))) autoDarkCarried = true;
        }
      }
      map.set(tokenPath, {
        type: tok.type,
        rawValue: value,
        provenance: {
          kind: autoDarkCarried ? PROVENANCE.DERIVED : PROVENANCE.AUTHORED,
          mode: overriddenMode ?? key,
          ...(autoDarkCarried ? { rule: 'auto-dark-carry(constant)@standard@1' } : {}),
        },
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

/** Structural equality for resolved values (colors are `{l,c,h,alpha}`). */
const sameValue = (a, b) =>
  a === b || (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && JSON.stringify(a) === JSON.stringify(b));

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
      if (!['authored', 'aliased'].includes(entry.provenance?.kind)) continue;
      // An explicit per-mode value on the slot itself is a decision, however it
      // compares — never second-guessed here.
      if (entry.provenance?.mode === `${DIM}=${scheme}`) continue;
      const baseline = base.get(tokenPath);
      // A slot that resolved to nothing in the default mode (dangling alias
      // TST1105, cycle TST1104, unparseable color TST1106 — each already
      // reported) has no value to carry over. Without this, `undefined` equals
      // `undefined` and the note claims an unchanged colour that never
      // existed: a consequence printed next to its cause.
      if (baseline?.value === undefined || !sameValue(entry.value, baseline.value)) continue;

      const dedupeKey = `${tokenPath}|${scheme}`;
      if (reported.has(dedupeKey)) continue;
      reported.add(dedupeKey);
      diagnostics.info(
        'TST1204',
        `${tokenPath} has no authored value for ${DIM}=${scheme} — the ${dim.default}-mode value carries over unchanged, and so does its whole derived grid`,
        autoDark
          ? { hint: `Author ${tokenPath} for ${DIM}=${scheme} if this role should differ in that mode. \`derivation.autoDark\` is on, so this carry-over is now classified "derived" in coverage — but it does not yet compute a distinct color (that transform is still an open research question; see the roadmap).` }
          : { hint: `Author ${tokenPath} for ${DIM}=${scheme} if this role should differ in that mode. This is default behavior — nothing is broken.` },
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
    hint: 'Break the loop: one of these tokens has to hold a literal value.',
  });
}

function resolveEntry(map, tokenPath, stack, diagnostics) {
  const entry = map.get(tokenPath);
  if (!entry) return undefined;
  if (entry.value !== undefined) return entry;
  if (entry.pendingAlias || entry.pendingMembers) return DEFERRED;
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
  if (COMPOSITES[entry.type]) {
    const memberStack = [...stack, tokenPath];
    return resolveComposite(entry, tokenPath, diagnostics, (memberTarget) =>
      map.has(memberTarget) ? resolveEntry(map, memberTarget, memberStack, diagnostics) : DEFERRED,
    );
  }
  try {
    entry.value = parseValue(entry.type, raw);
  } catch (e) {
    diagnostics.error('TST1106', `${tokenPath}: ${e.message}`, e.hint ? { hint: e.hint } : undefined);
    return undefined;
  }
  return entry;
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
 * form becomes the CSS string too, and the rest is carried as authored.
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
function parseMember(type, value) {
  // An alias to a color token arrives already parsed.
  if (type === 'color' && value !== null && typeof value === 'object' && ['l', 'c', 'h'].every((k) => typeof value[k] === 'number')) {
    return { ...value };
  }
  if (type === 'boolean' && typeof value !== 'boolean') {
    throw new Error(`expected true or false, got ${JSON.stringify(value)}`);
  }
  return parseValue(type, value);
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
      diagnostics.error('TST1106', `${at}: expected ${shape}, got ${JSON.stringify(layer)}`);
      failed = true;
      return undefined;
    }
    for (const name of spec.required) {
      if (!(name in layer)) {
        diagnostics.error('TST1106', `${at}.${name}: missing — a ${entry.type} needs ${spec.required.join(', ')}`);
        failed = true;
      }
    }
    const out = {};
    for (const [name, authored] of Object.entries(layer)) {
      const memberPath = `${at}.${name}`;
      let value = authored;
      const target = aliasTarget(authored);
      if (target) {
        const resolved = lookup(target);
        if (resolved === DEFERRED) { pending = true; continue; }
        if (resolved === CYCLE) { cycle = true; continue; } // already reported as TST1104
        if (!resolved || resolved.value === undefined) {
          diagnostics.error('TST1105', `Dangling alias in ${memberPath}: {${target}}`, {
            hint: `Nothing resolves to "${target}" — not authored, and not produced by derivation. Check the tier prefix (option./semantic./component.) and the spelling.`,
          });
          failed = true;
          continue;
        }
        value = resolved.value;
        members[memberPath.slice(tokenPath.length + 1)] = target;
      }
      try {
        out[name] = parseMember(spec.members[name], value);
      } catch (e) {
        diagnostics.error('TST1106', `${memberPath}${target ? ` (via {${target}})` : ''}: ${e.message}`, e.hint ? { hint: e.hint } : undefined);
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
export function resolveIfReady(map, tokenPath, stack = []) {
  const entry = map.get(tokenPath);
  if (!entry?.pendingAlias || stack.includes(tokenPath)) return entry;
  const target = entry.pendingAlias;
  const resolved = resolveIfReady(map, target, [...stack, tokenPath]);
  if (resolved?.value === undefined) return entry;
  entry.type = entry.type ?? resolved.type;
  entry.value = resolved.value;
  entry.provenance = { kind: 'aliased', target, mode: entry.provenance.mode };
  delete entry.pendingAlias;
  return entry;
}

function resolvePending(map, tokenPath, stack, diagnostics) {
  const entry = map.get(tokenPath);
  if (!entry || !(entry.pendingAlias || entry.pendingMembers)) return entry;
  if (stack.includes(tokenPath)) {
    reportCycle(diagnostics, [...stack, tokenPath]);
    delete entry.pendingAlias;
    delete entry.pendingMembers;
    return CYCLE;
  }
  if (entry.pendingMembers) {
    // A composite with a member aliasing a derived slot (`"color":
    // "{semantic.color.scrim}"`). Same rule as a whole-token alias: a target
    // that still doesn't exist is dangling now.
    const memberStack = [...stack, tokenPath];
    const resolved = resolveComposite(entry, tokenPath, diagnostics, (memberTarget) =>
      map.has(memberTarget) ? resolvePending(map, memberTarget, memberStack, diagnostics) : undefined,
    );
    delete entry.pendingMembers;
    return resolved;
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
