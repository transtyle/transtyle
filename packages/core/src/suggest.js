/**
 * suggestBindings() — deterministic binding proposals from a project's own
 * vocabulary to catalog slots (docs/specs/cli.md "bind --suggest", issue #60).
 *
 * Step 3 of adopting an existing design system is binding its names to the
 * catalog. Most of it is mechanical: a token called `brand` is almost always
 * `primary.solid`, a low-chroma color at the end of the lightness range is the
 * page. This reads the project's custom tokens and proposes, for every catalog
 * slot in scope that nothing binds yet, the token that fills it, with a
 * confidence and the reason in words. It is a lookup table and color
 * arithmetic, not a model (VISION non-goal 5): no network, no randomness, the
 * same answer on every run.
 *
 * Two kinds of evidence, never summed into a score:
 *   - **name**: the token's name read with the versioned table in synonyms.js;
 *   - **value**: the color's role shape in every mode (a surface is low chroma
 *     at the end of the lightness range, a border sits 1.2–3:1 off the page,
 *     body text reads at 4.5:1) or its distance to what derivation would give
 *     the slot, measured by a trial DERIVE with the first proposals injected.
 * Confidence comes from agreement: `high` when name and value agree, `medium`
 * for one of them, `low` for a value read in one mode only or an `option.*`
 * token. Two candidates the deciding signal can't separate are `contested`:
 * reported, never written as an alias (the importer contract's "questions,
 * not answers", docs/plan/importer-contract.md clause 4).
 *
 * The proposals come out two ways that expand to the same aliases: a DTCG
 * alias file (`tokens`), and `bindings` rules for the config (`rules`, the
 * pattern rules of ADR-0012, generalized with {role}/{rung}/{level} where the
 * vocabulary is regular and checked by expanding them).
 */

import { COLOR_ROLES, TEXT_RUNGS, PROVENANCE, collectTokens, mergeTrees } from '@transtyle/ir';
import { loadProject } from './load.js';
import { readTokenTrees, toFileMap } from './project.js';
import { validate } from './schema/validate.js';
import { configSchema } from './schema/config.schema.js';
import { expandBindings } from './bindings.js';
import { normalize, resolveDeferredAliases } from './normalize.js';
import { derive } from './derive.js';
import { Diagnostics } from './diagnostics.js';
import { contrastRatio } from './color.js';
import { deltaEOK } from './checks.js';
import { catalog, compareSlotPaths } from './catalog.js';
import { SYNONYMS_VERSION, FONT_GENERICS, readColorName, readFontName } from './synonyms.js';

const S = 'semantic.color.';

/** The roles whose `.solid` is in scope. `neutral` is a judgment call every time (examples/govuk, carbon READMEs): never proposed. */
const SCOPED_ROLES = ['primary', 'secondary', 'accent', 'success', 'warning', 'danger', 'info'];

/** Thresholds, in one place so the worklog and the docs can quote them. */
export const SUGGEST_THRESHOLDS = {
  lowChroma: 0.065, // a neutral (surface, border) has at most this OKLCH chroma in every mode
  canvasL: { light: 0.85, dark: 0.3 }, // the page: at least this light in light mode, at most this in dark
  level1Contrast: 1.25, // elevation.1 is a near neighbour of the page
  border: [1.2, 3], // a border's contrast against the page
  text: 4.5, // body text's contrast against the page
  linkText: 3, // a link's contrast against the page
  derivedDeltaE: 0.1, // ΔE_OK to what derivation would give the slot
  hueWindow: 10, // a status color on value alone: hue within this many degrees of the role's anchor…
  hueConfirm: 15, // …and a status name is confirmed within this one
  vividChroma: 0.08, // below this a hue means nothing (and a brand color is not a brand color)
  margin: { lightness: 0.01, deltaE: 0.03, chroma: 0.015, contrast: 0.05, hue: 3, border: 0.05 },
};
const T = SUGGEST_THRESHOLDS;

const r3 = (n) => Math.round(n * 1000) / 1000;
const f3 = (n) => n.toFixed(3);
const f2 = (n) => n.toFixed(2);
const floor1 = (n) => (Math.floor(n * 10) / 10).toFixed(1);
const hueDiff = (a, b) => {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return Math.min(d, 360 - d);
};
const short = (p) => (p.startsWith(S) ? p.slice(S.length) : p.startsWith('semantic.') ? p.slice('semantic.'.length) : p);

const CONFIDENCE_RANK = { high: 3, medium: 2, low: 1 };

/** NORMALIZE + DERIVE + deferred aliases on a copy of `trees`; diagnostics are discarded (`check` reports them). */
function resolveTrees(trees, config) {
  const d = new Diagnostics();
  const normalized = normalize(structuredClone(trees), config, d);
  derive(normalized, config, d);
  resolveDeferredAliases(normalized, d);
  return normalized;
}

/** Build a DTCG tree from `[path, token]` pairs. */
function treeOf(pairs) {
  const tree = {};
  for (const [p, token] of pairs) {
    const segs = p.split('.');
    let node = tree;
    for (const s of segs.slice(0, -1)) node = node[s] ??= {};
    node[segs.at(-1)] = token;
  }
  return tree;
}

/**
 * @param {{ cwd: string, configFile?: string }} options `configFile` as in compile();
 *   with `extends`, the merged config's token layers, a base's included
 * @returns {Promise<{ diagnostics: Diagnostics, report: object|null }>} `report`
 *   is null when the config or a token file can't be loaded (the errors are in
 *   `diagnostics`). Otherwise `{ synonyms, rulePack, modes, defaultMode, slots,
 *   tokens, rules }`, JSON-safe and byte-stable.
 */
export async function suggestBindings({ cwd, configFile }) {
  const diagnostics = new Diagnostics();
  const { config, files, projectDir, configChain } = await loadProject(cwd, { configFile });
  const leaf = configChain[configChain.length - 1];
  const where = configChain.length > 1 ? `${leaf} (merged with the configs it extends)` : leaf;
  for (const { path: p, message } of validate(config, configSchema)) {
    diagnostics.error('TST1010', `${where}: ${p === '(root)' ? '' : p + ' '}${message}`);
  }
  if (diagnostics.errors.length) return { diagnostics, report: null };

  const loaded = readTokenTrees(toFileMap(files), config.tokens, diagnostics, projectDir);
  const trees = [...loaded];
  const ruled = expandBindings(loaded, config, diagnostics);
  if (ruled && ruled.aliases.length > 0) {
    trees.push({ file: 'transtyle.config.json (bindings)', tree: ruled.tree, modeScope: undefined, bindingRules: ruled.rules });
  }
  // Only what makes the vocabulary unreadable stops a suggestion; a missing
  // `primary.solid` (TST1201) is the usual state of a project being bound.
  if (diagnostics.errors.length) return { diagnostics, report: null };

  const cat = catalog();
  const slotInfo = new Map(cat.slots.map((s) => [s.path, s]));
  const scope = [
    ...SCOPED_ROLES.map((r) => `${S}${r}.solid`),
    ...TEXT_RUNGS.map((r) => `${S}text.${r}`),
    `${S}elevation.0.surface`, `${S}elevation.1.surface`, `${S}border`, `${S}ring`,
    `${S}link.base`, `${S}link.hover`, `${S}link.visited`,
    'semantic.font.sans', 'semantic.font.mono', 'semantic.font.display',
  ];
  for (const p of scope) if (!slotInfo.has(p)) throw new Error(`suggestBindings: ${p} is not a catalog slot`);

  const base = resolveTrees(trees, config);
  const modes = [...base.modeValues];
  const defaultMode = base.defaultMode;
  const isDark = (m) => m === 'dark';
  const entry = (n, m, p) => n.modes[m]?.get(p);

  // ----- what is already bound -----
  const boundBy = new Map();
  for (const slot of scope) {
    for (const m of modes) {
      const e = entry(base, m, slot);
      if (e && (e.provenance.kind === PROVENANCE.AUTHORED || e.provenance.kind === PROVENANCE.ALIASED)) {
        boundBy.set(slot, e.provenance.kind === PROVENANCE.ALIASED ? `aliased → ${e.provenance.target}` : 'authored');
        break;
      }
    }
  }

  // ----- candidates: the project's own color and font tokens -----
  const catalogPaths = new Set(cat.slots.map((s) => s.path));
  const roleNames = new Set([...COLOR_ROLES, ...base.roleArchetypes.keys()]);
  const inGrid = (p) => {
    const segs = p.split('.');
    return segs[0] === 'semantic' && segs[1] === 'color' && roleNames.has(segs[2]);
  };
  const authored = collectTokens(mergeTrees(loaded.filter((t) => !t.modeScope).map((t) => t.tree)));
  // A token that is itself an alias of a catalog slot would make the binding a loop.
  const reachesCatalog = (p) => {
    const seen = new Set();
    let e = entry(base, defaultMode, p);
    while (e?.provenance.kind === PROVENANCE.ALIASED && !seen.has(e.provenance.target)) {
      const t = e.provenance.target;
      if (catalogPaths.has(t) || inGrid(t) || t.startsWith('component.')) return true;
      seen.add(t);
      e = entry(base, defaultMode, t);
    }
    return false;
  };
  const candidates = [];
  for (const [p, e] of base.modes[defaultMode]) {
    const tier = p.split('.')[0];
    if ((tier !== 'semantic' && tier !== 'option') || catalogPaths.has(p) || inGrid(p) || !authored.has(p)) continue;
    if (e.type !== 'color' && e.type !== 'fontFamily') continue;
    const values = {};
    for (const m of modes) values[m] = entry(base, m, p)?.value;
    if (Object.values(values).some((v) => v === undefined || (e.type === 'color' && typeof v?.l !== 'number'))) continue;
    if (reachesCatalog(p)) continue;
    candidates.push({
      path: p,
      type: e.type,
      option: tier === 'option',
      values,
      name: e.type === 'color' ? readColorName(p) : readFontName(p),
    });
  }
  candidates.sort((a, b) => compareSlotPaths(a.path, b.path));

  // ----- decisions -----
  const canvas = `${S}elevation.0.surface`;
  const decided = new Map(); // slot → { winner, confidence, reasons, ranked, contested }
  const won = new Map(); // token path → slots it won
  let reference = base; // values of slots nothing proposes: base, then the trial derivation
  const ref = (slot, m) => {
    const d = decided.get(slot);
    if (d?.winner) return d.winner.cand.values[m];
    return entry(reference, m, slot)?.value;
  };
  const perMode = (fn) => modes.map((m) => fn(m));
  const modeText = (nums, fmt) => nums.map(fmt).join(' | ');

  /**
   * Rank and decide one slot. `measure(c)` returns null (no value evidence) or
   * `{ pass, confirm, metric, text }`; `better(a, b)` < 0 when metric a wins.
   */
  const decide = (slot, { measure, better, close, valueOnly = true, valueOnlyConfidence = 'medium', nameIsFamily = false, exclude = () => false, drop = () => false, nameSlot }) => {
    const wantName = nameSlot ?? short(slot);
    const ranked = [];
    for (const c of candidates) {
      if (c.type !== slotInfo.get(slot).type || drop(c)) continue;
      const nameHit = c.name?.slot === wantName;
      if (!nameHit) {
        // Value alone: only for a token whose name claims nothing (a text name may still be the brand color).
        if (!valueOnly || c.option || exclude(c) || (c.name && !(slot === `${S}primary.solid` && c.name.family === 'text'))) continue;
      }
      const value = measure(c);
      if (!nameHit && !value?.pass) continue;
      const reasons = [];
      if (nameHit) reasons.push(`name "${c.name.words.join('-')}" → ${wantName === 'elevation.surface' ? 'a surface (level by value)' : wantName}`);
      if (value) reasons.push(value.text);
      let confidence;
      if (c.option) confidence = 'low';
      else if (nameHit && (value?.confirm ?? value?.pass)) confidence = 'high';
      else if (nameHit) confidence = 'medium';
      else confidence = valueOnlyConfidence;
      ranked.push({ cand: c, nameHit, value, confidence, reasons, evidence: nameHit && value?.pass ? 'name+value' : nameHit ? 'name' : 'value' });
    }
    ranked.sort((a, b) =>
      CONFIDENCE_RANK[b.confidence] - CONFIDENCE_RANK[a.confidence]
      || Number(b.nameHit) - Number(a.nameHit)
      || (a.value && b.value ? better(a.value.metric, b.value.metric) : 0)
      || compareSlotPaths(a.cand.path, b.cand.path));
    const [top, next] = ranked;
    let contested = false;
    if (top && next && next.confidence === top.confidence && next.nameHit === top.nameHit) {
      if (top.nameHit && !nameIsFamily) contested = !sameValues(top.cand, next.cand);
      else if (top.value && next.value) contested = close(top.value.metric, next.value.metric) && !sameValues(top.cand, next.cand);
    }
    const d = { winner: contested ? null : top ?? null, confidence: top?.confidence, ranked, contested };
    if (top && !contested && next) top.reasons.push(`next: ${next.cand.path}`);
    decided.set(slot, d);
    if (d.winner) won.set(top.cand.path, [...(won.get(top.cand.path) ?? []), slot]);
    return d;
  };
  const sameValues = (a, b) => modes.every((m) => {
    const x = a.values[m], y = b.values[m];
    return a.type === 'color' ? deltaEOK(x, y) < 1e-9 && x.alpha === y.alpha : JSON.stringify(x) === JSON.stringify(y);
  });
  const run = (slot, opts) => (boundBy.has(slot) ? null : decide(slot, opts));
  const wonAny = (c, slots) => (won.get(c.path) ?? []).some((s) => !slots || slots.includes(s));
  const lowChroma = (c) => modes.every((m) => c.values[m].c <= T.lowChroma);
  // The page in every mode, or null when nothing gives it a value yet (no
  // canvas candidate and no primary to derive the default from).
  const page = () => {
    const v = perMode((m) => ref(canvas, m));
    return v.every((x) => typeof x?.l === 'number') ? v : null;
  };
  const onPage = (c) => {
    const p = page();
    return p && modes.map((m, i) => contrastRatio(c.values[m], p[i]));
  };
  const derivedDelta = (slot) => (c) => {
    const d = perMode((m) => {
      const target = ref(slot, m);
      return target && typeof target.l === 'number' ? deltaEOK(c.values[m], target) : NaN;
    });
    if (d.some(Number.isNaN)) return null;
    const pass = d.every((x) => x <= T.derivedDeltaE);
    return { pass, metric: Math.max(...d), text: `ΔE ${modeText(d, f3)} to what ${short(slot)} derives to` };
  };
  const lowerIsBetter = (a, b) => a - b;
  const higherIsBetter = (a, b) => b - a;
  const within = (m) => (a, b) => Math.abs(a - b) < m;

  run(canvas, {
    nameSlot: 'elevation.surface',
    nameIsFamily: true,
    measure: (c) => {
      const L = perMode((m) => c.values[m].l);
      const extreme = modes.map((m, i) => (isDark(m) ? 1 - L[i] : L[i]));
      const pass = lowChroma(c) && modes.every((m, i) => (isDark(m) ? L[i] <= T.canvasL.dark : L[i] >= T.canvasL.light));
      const mean = extreme.reduce((a, b) => a + b, 0) / extreme.length;
      return { pass, metric: mean, text: `${pass ? 'low-chroma page color, ' : ''}L ${modeText(L, f2)} (${modes.join(' | ')})` };
    },
    better: higherIsBetter,
    close: within(T.margin.lightness),
  });
  run(`${S}elevation.1.surface`, {
    nameSlot: 'elevation.surface',
    nameIsFamily: true,
    // A token that is the page is never level 1 as well.
    drop: (c) => wonAny(c, [canvas]),
    measure: (c) => {
      const p = page();
      if (!p) return null;
      const d = modes.map((m, i) => deltaEOK(c.values[m], p[i]));
      const k = onPage(c);
      const pass = lowChroma(c) && k.every((x) => x < T.level1Contrast) && d.some((x) => x > 0);
      return { pass, metric: Math.max(...d), text: `${pass ? 'low-chroma neighbour of the page, ' : ''}ΔE ${modeText(d, f3)} from the page` };
    },
    better: lowerIsBetter,
    close: within(T.margin.deltaE),
  });
  run(`${S}border`, {
    exclude: (c) => wonAny(c),
    measure: (c) => {
      const k = onPage(c);
      if (!k) return null;
      const pass = lowChroma(c) && k.every((x) => x >= T.border[0] && x <= T.border[1]);
      return { pass, metric: Math.max(...k.map((x) => Math.abs(Math.log(x / 1.5)))), text: `${lowChroma(c) ? 'low chroma, ' : ''}${modeText(k, floor1)}:1 on the page` };
    },
    better: lowerIsBetter,
    close: within(T.margin.border),
  });
  run(`${S}text.base`, {
    exclude: (c) => wonAny(c),
    measure: (c) => {
      const k = onPage(c);
      if (!k) return null;
      return { pass: k.every((x) => x >= T.text), metric: Math.min(...k), text: `${modeText(k, floor1)}:1 on the page` };
    },
    better: higherIsBetter,
    close: (a, b) => Math.abs(a - b) / Math.max(a, b) < T.margin.contrast,
  });
  run(`${S}primary.solid`, {
    // Value alone reads the default mode only: the brand's native expression,
    // but one mode, so never more than low.
    valueOnlyConfidence: 'low',
    exclude: (c) => wonAny(c, [canvas, `${S}elevation.1.surface`, `${S}border`]),
    measure: (c) => {
      const C = c.values[defaultMode].c;
      return { pass: C >= T.vividChroma, metric: C, text: `chroma ${f2(C)} in ${defaultMode}` };
    },
    better: higherIsBetter,
    close: within(T.margin.chroma),
  });

  // Trial derivation: inject the phase-1 picks (a contested slot's top
  // candidate too, as the best guess) and read what the remaining slots would
  // derive to.
  const injected = [];
  for (const [slot, d] of decided) {
    const pick = d.winner ?? d.ranked[0];
    if (pick) injected.push([slot, { $value: `{${pick.cand.path}}` }]);
  }
  if (injected.length) {
    reference = resolveTrees([...trees, { file: '(suggestion trial)', tree: treeOf(injected), modeScope: undefined }], config);
  }

  // Phase 2: text rungs.
  const firstWinners = () => [canvas, `${S}elevation.1.surface`, `${S}border`, `${S}text.base`, `${S}primary.solid`];
  for (const rung of TEXT_RUNGS) {
    if (rung === 'base') continue;
    const slot = `${S}text.${rung}`;
    const delta = derivedDelta(slot);
    const baseContrast = (c) => {
      const k = onPage(c);
      const b = page() && perMode((m) => ref(`${S}text.base`, m));
      return k && b?.every((x) => typeof x?.l === 'number') ? { k, base: modes.map((m, i) => contrastRatio(b[i], page()[i])) } : null;
    };
    run(slot, {
      valueOnly: rung === 'muted',
      exclude: (c) => wonAny(c, firstWinners()),
      measure: (c) => {
        const d = delta(c);
        // A muted name is also confirmed by its shape: readable (3:1) but quieter than body text.
        const shape = rung === 'muted' ? baseContrast(c) : null;
        const quieter = shape && shape.k.every((x, i) => x >= T.linkText && x < shape.base[i]);
        if (!d) return null;
        return { ...d, confirm: d.pass || Boolean(quieter), text: quieter ? `${d.text}, ${modeText(shape.k, floor1)}:1 on the page` : d.text };
      },
      better: lowerIsBetter,
      close: within(T.margin.deltaE),
    });
  }

  // Phase 3: status roles: hue against the anchor the rule pack uses (read off the catalog).
  const statusWinners = [];
  for (const role of ['danger', 'warning', 'success', 'info']) {
    const slot = `${S}${role}.solid`;
    const anchor = Number(/^hue-anchor\((\d+(?:\.\d+)?)\)$/.exec(slotInfo.get(slot).rule ?? '')?.[1]);
    if (!Number.isFinite(anchor)) throw new Error(`suggestBindings: ${slot} has no hue-anchor rule in the catalog`);
    const delta = derivedDelta(slot);
    const d = run(slot, {
      // `info`'s anchor hue is where brand blues live: a name is required.
      valueOnly: role !== 'info',
      exclude: (c) => wonAny(c) || statusWinners.includes(c.path),
      measure: (c) => {
        const h = perMode((m) => (c.values[m].c >= T.vividChroma ? hueDiff(c.values[m].h, anchor) : Infinity));
        const dE = delta(c);
        const near = (w) => h.every((x) => x <= w) || Boolean(dE?.pass);
        const hues = h.map((x) => (Number.isFinite(x) ? `${Math.round(x)}°` : 'gray'));
        return {
          pass: near(T.hueWindow),
          confirm: near(T.hueConfirm),
          metric: Math.max(...h.map((x) => (Number.isFinite(x) ? x : 360))),
          text: `hue ${hues.join(' | ')} off the ${role} anchor (${anchor})${dE ? `, ${dE.text}` : ''}`,
        };
      },
      better: lowerIsBetter,
      close: within(T.margin.hue),
    });
    if (d?.winner) statusWinners.push(d.winner.cand.path);
  }

  // Phase 4: name-only slots, confirmed by their distance to the derived value.
  for (const slot of [`${S}secondary.solid`, `${S}accent.solid`, `${S}ring`]) {
    run(slot, { valueOnly: false, measure: derivedDelta(slot), better: lowerIsBetter, close: within(T.margin.deltaE) });
  }
  // A link name is confirmed by the link's shape: readable on the page (3:1) in every mode.
  for (const slot of [`${S}link.base`, `${S}link.hover`, `${S}link.visited`]) {
    run(slot, {
      valueOnly: false,
      measure: (c) => {
        const k = onPage(c);
        if (!k) return null;
        return { pass: k.every((x) => x >= T.linkText), metric: Math.min(...k), text: `${modeText(k, floor1)}:1 on the page` };
      },
      better: higherIsBetter,
      close: (a, b) => Math.abs(a - b) / Math.max(a, b) < T.margin.contrast,
    });
  }

  // Phase 5: fonts, by name and by the generic family that ends the stack.
  for (const font of ['sans', 'mono', 'display']) {
    run(`semantic.font.${font}`, {
      measure: (c) => {
        const stack = c.values[defaultMode];
        const last = (Array.isArray(stack) ? stack : String(stack).split(',')).map((s) => String(s).trim().replace(/^["']|["']$/g, '')).at(-1);
        const generic = FONT_GENERICS[last?.toLowerCase()];
        return generic ? { pass: generic === font, metric: 0, text: `stack ends in ${last}` } : null;
      },
      better: () => 0,
      close: () => true,
    });
  }

  // ----- report -----
  const slots = [...scope].sort(compareSlotPaths).map((slot) => {
    const info = slotInfo.get(slot);
    const out = { slot, type: info.type };
    if (boundBy.has(slot)) return { ...out, status: 'bound', bound: boundBy.get(slot) };
    const d = decided.get(slot);
    const candidatesOut = (d?.ranked ?? []).slice(0, 3).map((r) => ({
      token: r.cand.path, confidence: r.confidence, evidence: r.evidence, reasons: [...r.reasons],
      ...(r.value ? { metric: r3(r.value.metric) } : {}),
    }));
    if (d?.winner) {
      return { ...out, status: 'proposed', from: d.winner.cand.path, confidence: d.winner.confidence, reasons: [...d.winner.reasons], candidates: candidatesOut };
    }
    if (d?.contested) return { ...out, status: 'contested', candidates: candidatesOut };
    return { ...out, status: 'none', fallback: info.kind === 'authored-only' ? 'author it' : `${info.kind} by ${info.rule}` };
  });

  const proposals = slots.filter((s) => s.status === 'proposed');
  const contested = slots.filter((s) => s.status === 'contested');
  const pairs = proposals.map((s) => [s.slot, {
    $value: `{${s.from}}`,
    $description: `suggested (${s.confidence}): ${s.reasons.join('; ')} · ${SYNONYMS_VERSION}`,
  }]);
  const body = treeOf(pairs);
  if (body.semantic?.color) body.semantic.color = { $type: 'color', ...body.semantic.color };
  const description = `Suggested by transtyle bind --suggest (${SYNONYMS_VERSION}, ${cat.rulePack}): review every alias before adding this file to "tokens".`
    + (contested.length ? ` Contested, not written: ${contested.map((s) => `${s.slot} (${s.candidates.map((c) => c.token).join(' or ')})`).join('; ')}.` : '');

  const tokens = { $description: description, ...body };
  const rules = toRules(proposals, loaded, config, [...COLOR_ROLES, ...[...base.roleArchetypes.keys()].sort()]);

  return {
    diagnostics,
    report: { synonyms: SYNONYMS_VERSION, rulePack: cat.rulePack, modes, defaultMode, slots, tokens, rules },
  };
}

/**
 * The proposals as config `bindings` rules (ADR-0012). Proposals whose slot
 * and token differ only by the same role, rung or level become one rule with
 * that placeholder (`roles` lists exactly the roles proposed); everything else
 * is a literal rule. Each generalized rule is expanded with expandBindings()
 * and kept only when it gives exactly its own proposals, then the whole set is
 * checked the same way, so the rules can never bind more than the alias file.
 */
function toRules(proposals, trees, config, allRoles) {
  const placeholderOf = (slot) => {
    let m = /^semantic\.color\.([^.]+)\.solid$/.exec(slot);
    if (m && allRoles.includes(m[1])) return ['role', m[1]];
    m = /^semantic\.color\.text\.([^.]+)$/.exec(slot);
    if (m) return ['rung', m[1]];
    m = /^semantic\.color\.elevation\.(\d+)\.surface$/.exec(slot);
    if (m) return ['level', m[1]];
    return null;
  };
  const groups = new Map();
  const literal = [];
  for (const p of proposals) {
    const ph = placeholderOf(p.slot);
    const fromSegs = p.from.split('.');
    if (!ph || !fromSegs.includes(ph[1])) { literal.push(p); continue; }
    const slotT = p.slot.split('.').map((s) => (s === ph[1] ? `{${ph[0]}}` : s)).join('.');
    const fromT = fromSegs.map((s) => (s === ph[1] ? `{${ph[0]}}` : s)).join('.');
    const key = `${slotT}\u0000${fromT}`;
    if (!groups.has(key)) groups.set(key, { slot: slotT, from: `{${fromT}}`, placeholder: ph[0], members: [] });
    groups.get(key).members.push(p);
  }
  const expand = (rules) => expandBindings(trees, { ...config, bindings: rules }, new Diagnostics())?.aliases ?? [];
  const asSet = (aliases) => aliases.map((a) => `${a.slot}=${a.from}`).sort().join('\n');
  const rules = [];
  for (const g of groups.values()) {
    const rule = { slot: g.slot, from: g.from };
    if (g.placeholder === 'role') {
      const roles = g.members.map((p) => placeholderOf(p.slot)[1]);
      rule.roles = allRoles.filter((r) => roles.includes(r));
    }
    const want = asSet(g.members.map((p) => ({ slot: p.slot, from: `{${p.from}}` })));
    if (g.members.length > 1 && asSet(expand([rule])) === want) rules.push({ rule, first: g.members[0].slot });
    else literal.push(...g.members);
  }
  for (const p of literal) rules.push({ rule: { slot: p.slot, from: `{${p.from}}` }, first: p.slot });
  rules.sort((a, b) => compareSlotPaths(a.first, b.first));
  const out = rules.map((r) => r.rule);
  const want = asSet(proposals.map((p) => ({ slot: p.slot, from: `{${p.from}}` })));
  if (asSet(expand(out)) !== want) throw new Error('suggestBindings: the bindings rules do not expand to the proposed aliases');
  return out;
}
