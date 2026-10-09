/**
 * Exporter reads: which catalog slots each target reads while it emits
 * (issue #160, after `transtyle check --matrix`, #95).
 *
 * Coverage rows can't answer that question on their own. A row says which slot
 * a target variable comes from, as a human label: Radix names its ramps with
 * role wildcards, Bootstrap answers most rows "via driven roots", PrimeNG has
 * brace patterns. An exact-path reading of those labels misses most of what
 * each exporter reads.
 *
 * So `compile()` records the read set instead: while an exporter's `emit()`
 * runs, each resolved mode map it receives is a `RecordingMap` that notes
 * every slot the exporter looks up (`get`, `has`) or opens while iterating
 * (reading a property of an entry it was handed). Listing keys alone is not a
 * read: css-variables walks every key and keeps the `semantic.*` ones, and only
 * the entries it then looks up count. No exporter changes, third-party
 * exporters included, and the recording never changes what the exporter sees:
 * same keys, same entry values, same map identity across mode aliases.
 */

import { coverageSlots } from './explain.js';

const CLASS_RANK = ['native', 'derived', 'approximated'];

/** Tiers that make up the catalog. `option.*` is the raw scale, not a slot. */
const isCatalogSlot = (slot) => slot.startsWith('semantic.') || slot.startsWith('component.');

class RecordingMap extends Map {
  #reads;
  #entries = new Map();

  constructor(source, reads) {
    super(source);
    this.#reads = reads;
  }

  get(key) {
    this.#reads.add(key);
    return super.get(key);
  }

  has(key) {
    this.#reads.add(key);
    return super.has(key);
  }

  /** An entry handed out by iteration records its slot the first time it's opened. */
  #entry(key, value) {
    if (value === null || typeof value !== 'object') return value;
    let proxy = this.#entries.get(key);
    if (!proxy) {
      const reads = this.#reads;
      proxy = new Proxy(value, {
        get(target, prop, receiver) {
          reads.add(key);
          return Reflect.get(target, prop, receiver);
        },
      });
      this.#entries.set(key, proxy);
    }
    return proxy;
  }

  *entries() {
    for (const [k, v] of super.entries()) yield [k, this.#entry(k, v)];
  }

  *values() {
    for (const [k, v] of super.entries()) yield this.#entry(k, v);
  }

  [Symbol.iterator]() {
    return this.entries();
  }

  forEach(fn, thisArg) {
    for (const [k, v] of this.entries()) fn.call(thisArg, v, k, this);
  }
}

/**
 * The view an exporter is handed, with every mode map recording what it reads.
 * `reads()` returns the catalog slots read so far that exist in the view,
 * sorted: a lookup of a slot the design system doesn't resolve (an exporter
 * probing for an optional role) is not a read of anything.
 */
export function recordingView(view) {
  const seen = new Set();
  const proxies = new Map();
  const modes = {};
  for (const [name, map] of Object.entries(view.modes)) {
    if (!(map instanceof Map)) { modes[name] = map; continue; }
    // modes.light / modes.dark alias combo maps: keep them the same object.
    if (!proxies.has(map)) proxies.set(map, new RecordingMap(map, seen));
    modes[name] = proxies.get(map);
  }
  const reads = () => {
    const present = new Set();
    for (const map of proxies.keys()) for (const k of map.keys()) present.add(k);
    return [...seen].filter((s) => isCatalogSlot(s) && present.has(s)).sort();
  };
  return { view: { ...view, modes }, reads };
}

/**
 * The slot × target consumption matrix of a compile result
 * (`transtyle check --matrix`): for each catalog slot, the targets that read
 * it, from each target result's `reads`.
 *
 * Returns `{ targets, slots }` where `slots[slot][target] = { class, variables }`
 * for every target that read the slot; `variables` lists the coverage rows
 * naming the slot exactly, in their `slots` or as their `slot`
 * (`coverageSlots()`). The cell's class is the best of those rows'
 * (native, derived, approximated); a slot that is read but named by no row is
 * `input`: it feeds a value some other row describes (a Radix ramp step, a
 * PrimeNG surface, a Bootstrap chained variable). That errs on the safe side:
 * an exporter that reads a slot and ignores it still counts. Every catalog
 * slot of the compile has an entry, even one no target reads (`{}`). Keys are
 * sorted: the output is deterministic.
 *
 * @param result `compile()`'s result (`normalized`, `results` with `reads`)
 */
export function consumption(result) {
  const targets = result.results.map((r) => r.target);
  const catalog = new Set();
  for (const map of Object.values(result.normalized?.modes ?? {})) {
    if (map instanceof Map) for (const k of map.keys()) if (isCatalogSlot(k)) catalog.add(k);
  }

  const slots = {};
  for (const slot of [...catalog].sort()) slots[slot] = {};

  for (const r of result.results) {
    const named = new Map();
    for (const row of r.coverage) {
      if (!CLASS_RANK.includes(row.class)) continue;
      for (const slot of coverageSlots(row, result.normalized)) {
        if (!catalog.has(slot)) continue;
        if (!named.has(slot)) named.set(slot, []);
        named.get(slot).push(row);
      }
    }
    for (const slot of (r.reads ?? []).filter((s) => catalog.has(s))) {
      const rows = named.get(slot) ?? [];
      const best = rows.map((row) => row.class).sort((a, b) => CLASS_RANK.indexOf(a) - CLASS_RANK.indexOf(b))[0];
      slots[slot][r.target] = {
        class: best ?? 'input',
        variables: [...new Set(rows.map((row) => row.variable))].sort(),
      };
    }
  }

  return { targets, slots };
}
