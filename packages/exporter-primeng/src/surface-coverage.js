/**
 * AL3: classify every slot of PrimeNG's theming surface (surface-inventory.json)
 * against what this exporter actually emits — the numerator over AL3's
 * denominator. Shared by the exporter (which turns it into report.json rows)
 * and scripts/check-coverage-bar.mjs (which enforces completeness), so the
 * two can never disagree.
 *
 * PrimeNG resolves `{token.path}` references at runtime through its own
 * semantic tier, so "driven" has three honest shapes here, not one:
 *
 *   driven     — this exporter emits the slot itself (Button's grid, formField,
 *                list/navigation/overlay/content, the ramps).
 *   inherited  — Aura's own default for the slot is a REFERENCE into a semantic
 *                path this exporter drives, so the component follows our theme
 *                without us naming it. This is real coverage, not a gap — it is
 *                how PrimeNG is designed to be themed.
 *   base       — Aura's default is a literal we don't override (a padding, a
 *                font weight), or a reference into a semantic path we don't
 *                drive. The slot keeps Aura's value: honest `unsupported`,
 *                always with a note. Never silent — that is the AL3 bar.
 */

import { readFileSync } from 'node:fs';

export const INVENTORY = JSON.parse(
  readFileSync(new URL('../surface-inventory.json', import.meta.url), 'utf8'),
);

/** Collect every leaf path of the emitted preset object (`semantic.x.y`, `components.button.…`). */
export function emittedPaths(preset) {
  const out = new Set();
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const path = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
      else out.add(path);
    }
  };
  walk(preset.semantic, 'semantic');
  walk(preset.components, 'components');
  return out;
}

/**
 * Does our emitted preset drive the semantic path an Aura reference points at?
 * Aura writes references in ITS namespace (`{content.background}`,
 * `{primary.color}`, `{form.field.padding.x}`), which is our emitted
 * `semantic.*` object with dots collapsed — `form.field.x` is `formField.x`.
 * Compare on a normalized, case- and separator-insensitive key so the check
 * doesn't hinge on PrimeNG's cosmetic dotting.
 */
const normalize = (s) => s.toLowerCase().replace(/[.\-_]/g, '');

export function drivenSemanticKeys(preset) {
  const keys = new Set();
  const walk = (obj, prefix) => {
    for (const [k, v] of Object.entries(obj ?? {})) {
      const path = prefix ? `${prefix}.${k}` : k;
      keys.add(normalize(path));
      if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, path);
    }
  };
  // Both the mode-invariant half and one colorScheme half (they share names).
  walk(preset.semantic, '');
  walk(preset.semantic?.colorScheme?.light, '');
  return keys;
}

/**
 * Classify one inventory slot. Returns { class, reason, note? } where `class`
 * is a coverage class from validation-and-coverage.md.
 */
export function classifySlot(slot, emitted, drivenKeys) {
  const fullPath = slot.group === 'semantic' ? `semantic.${slot.path}` : `components.${slot.path}`;
  if (emitted.has(fullPath)) {
    return { class: 'native', reason: 'driven', note: 'emitted directly by this exporter' };
  }
  if (slot.kind === 'ref' && slot.ref) {
    // Aura's default points into its semantic tier; if we drive that path the
    // slot follows our theme at runtime.
    const key = normalize(slot.ref);
    // EXACT match only. A prefix rule ("we drive some formField.* keys, so
    // {form.field.font.size} must be covered") was tried and rejected: it
    // over-claimed 221 slots we demonstrably do not drive — `formField.fontSize`
    // and `formField.focusRing.*` among them. Inflating coverage is the one
    // outcome this bar exists to prevent. `drivenSemanticKeys` already walks
    // every nested path we emit, so exact matching covers real nesting.
    const driven =
      drivenKeys.has(key) ||
      // `{primary.500}`/`{surface.200}` address the ramps we emit wholesale.
      /^(primary|surface)\d+$/.test(key);
    if (driven) {
      return {
        class: 'derived',
        reason: 'inherited',
        note: `follows our theme through PrimeNG's own reference {${slot.ref}}`,
      };
    }
    return {
      class: 'unsupported',
      reason: 'base',
      note: `Aura default references {${slot.ref}}, a semantic path this exporter does not drive`,
    };
  }
  return {
    class: 'unsupported',
    reason: 'base',
    note: `Aura's own literal (${slot.value}) kept — this exporter does not override this slot`,
  };
}

/** Classify the whole inventory. Returns { rows, counts }. */
export function classifySurface(inventory, preset) {
  const emitted = emittedPaths(preset);
  const drivenKeys = drivenSemanticKeys(preset);
  const rows = inventory.slots.map((slot) => ({
    slot,
    ...classifySlot(slot, emitted, drivenKeys),
  }));
  const counts = { native: 0, derived: 0, approximated: 0, dropped: 0, unsupported: 0 };
  const byReason = { driven: 0, inherited: 0, base: 0 };
  for (const r of rows) {
    counts[r.class]++;
    byReason[r.reason]++;
  }
  return { rows, counts, byReason };
}

/** Compact per-family summary rows for report.json (2759 individual rows would drown it). */
export function coverageRows(inventory, preset) {
  const { rows, byReason } = classifySurface(inventory, preset);
  const families = new Map();
  for (const r of rows) {
    const f = r.slot.family;
    if (!families.has(f)) families.set(f, { driven: 0, inherited: 0, base: 0, example: null });
    const e = families.get(f);
    e[r.reason]++;
    if (r.reason === 'base' && !e.example) e.example = r.note;
  }
  const out = [];
  for (const [family, e] of [...families.entries()].sort()) {
    const total = e.driven + e.inherited + e.base;
    const cls = e.driven ? 'native' : e.inherited > e.base ? 'derived' : 'unsupported';
    out.push({
      variable: `${family}.* (${total} slots)`,
      slot:
        e.driven || e.inherited
          ? `${e.driven} driven · ${e.inherited} inherited via our semantic tier · ${e.base} on Aura's default`
          : "Aura's own defaults",
      class: cls,
      note:
        e.base > 0
          ? `${e.base} slot(s) keep Aura's value — ${e.example}`
          : 'every slot follows this theme',
    });
  }
  out.push({
    variable: 'PrimeNG surface totals',
    slot: `${byReason.driven} driven · ${byReason.inherited} inherited · ${byReason.base} Aura default`,
    class: 'derived',
    note: `measured against surface-inventory.json (@primeuix/themes ${inventory.themesVersion}); AL3 bar: every slot classified, no silent gap`,
  });
  return out;
}
