/**
 * The slot × target consumption matrix (`transtyle check --matrix`, issue #95):
 * for each catalog slot, which targets read it.
 *
 * Coverage rows can't answer that question on their own. A row says which slot
 * a target variable comes from, as a human label: ECharts names the palette in
 * one range row (`semantic.palette.categorical.1–8`), Radix names its ramps
 * with role wildcards, Bootstrap answers most rows "via driven roots". An
 * exact-path reading of those labels misses most of what each exporter reads.
 *
 * So the read set is recorded instead: while an exporter's `emit()` runs, each
 * resolved mode map it receives is a `RecordingMap` that notes every slot the
 * exporter looks up (`get`, `has`) or opens while iterating (reading a
 * property of an entry it was handed). Listing keys alone is not a read:
 * css-variables walks every key and keeps the `semantic.*` ones, and only the
 * entries it then looks up count. No exporter changes, third-party exporters
 * included, and the recording never touches the IR the exporter sees: same
 * keys, same entry values, same map identity across mode aliases.
 *
 * The cell's class comes from the coverage rows that name the slot exactly
 * (the best of native, derived, approximated). A slot that is read but named
 * by no row is `input`: it feeds a value some other row describes (a Radix
 * ramp step, a PrimeNG surface, a Bootstrap chained variable). That errs on
 * the safe side: an exporter that reads a slot and ignores it still counts.
 */

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
 * Wrap an exporter so each `emit()` records the slots it reads. Returns the
 * wrapped exporter (everything else reached through the prototype chain, so
 * `optionsSchema`, `name` and friends are untouched) and its read set.
 */
export function recordReads(exporter) {
  const reads = new Set();
  const wrapped = Object.create(exporter, {
    emit: {
      value(normalized, ctx) {
        const proxies = new Map();
        const modes = {};
        for (const [name, map] of Object.entries(normalized.modes)) {
          if (!(map instanceof Map)) { modes[name] = map; continue; }
          // modes.light / modes.dark alias combo maps: keep them the same object.
          if (!proxies.has(map)) proxies.set(map, new RecordingMap(map, reads));
          modes[name] = proxies.get(map);
        }
        return exporter.emit.call(this, { ...normalized, modes }, ctx);
      },
    },
  });
  return { exporter: wrapped, reads };
}

/**
 * A `loadExporter` for `compile()` that records each target's reads.
 *
 * `compile()` loads one exporter per target instance, in target order, and
 * pushes one result per load (an empty one when the load fails), so
 * `readSets[i]` belongs to `results[i]`. The slot is reserved before the load
 * so a failed load keeps the two aligned.
 */
export function recordingLoader(loadExporter) {
  const readSets = [];
  async function load(name) {
    const i = readSets.push(new Set()) - 1;
    const recorded = recordReads(await loadExporter(name));
    readSets[i] = recorded.reads;
    return recorded.exporter;
  }
  return { loadExporter: load, readSets };
}

/**
 * Build the matrix from a compile result and the per-target read sets
 * (same order as `results`).
 *
 * Returns `{ targets, slots }` where `slots[slot][target] = { class, variables }`
 * for every target that read the slot; `variables` lists the coverage rows
 * naming the slot exactly. Every catalog slot of the compile has an entry,
 * even one no target reads (`{}`). Keys are sorted: the output is deterministic.
 */
export function consumption(result, readSets) {
  const targets = result.results.map((r) => r.target);
  const catalog = new Set();
  for (const map of Object.values(result.normalized?.modes ?? {})) {
    if (map instanceof Map) for (const k of map.keys()) if (isCatalogSlot(k)) catalog.add(k);
  }

  const slots = {};
  for (const slot of [...catalog].sort()) slots[slot] = {};

  result.results.forEach((r, i) => {
    const named = new Map();
    for (const row of r.coverage) {
      if (!catalog.has(row.slot) || !CLASS_RANK.includes(row.class)) continue;
      if (!named.has(row.slot)) named.set(row.slot, []);
      named.get(row.slot).push(row);
    }
    for (const slot of [...(readSets[i] ?? [])].filter((s) => catalog.has(s)).sort()) {
      const rows = named.get(slot) ?? [];
      const best = rows.map((row) => row.class).sort((a, b) => CLASS_RANK.indexOf(a) - CLASS_RANK.indexOf(b))[0];
      slots[slot][r.target] = {
        class: best ?? 'input',
        variables: [...new Set(rows.map((row) => row.variable))].sort(),
      };
    }
  });

  return { targets, slots };
}

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
