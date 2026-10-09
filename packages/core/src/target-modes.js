/**
 * Per-target mode subsets (`targets.<t>.modes`, issue #89).
 *
 * Modes are declared once for the project and the whole matrix is derived and
 * checked once. A target may then ask for a slice of it; its exporter receives
 * a view of the normalized IR holding only the kept combos, so no exporter
 * needs to know the option exists (a single-value dimension already behaves
 * like a single-mode config).
 */

import { comboKey } from '@transtyle/ir';

/**
 * TST1308: a subset naming a dimension or value the project's `modes` doesn't
 * declare, or leaving out a dimension's default (the base block would have no
 * source). Errors are reported per offending entry; nothing is emitted.
 */
export function validateTargetModes(target, subset, dimensions, diagnostics) {
  for (const [dim, kept] of Object.entries(subset)) {
    const def = dimensions[dim];
    if (!def) {
      diagnostics.error('TST1308', `target "${target}": modes.${dim} — "${dim}" is not a mode dimension of this project`, {
        hint: `Declared dimensions: ${Object.keys(dimensions).join(', ')}.`,
      });
      continue;
    }
    const unknown = kept.filter((v) => !def.values.includes(v));
    if (unknown.length > 0) {
      diagnostics.error(
        'TST1308',
        `target "${target}": modes.${dim} — ${unknown.map((v) => `"${v}"`).join(', ')} not declared in modes.${dim}.values`,
        { hint: `Declared values: ${def.values.join(', ')}.` },
      );
    }
    if (!kept.includes(def.default)) {
      diagnostics.error('TST1308', `target "${target}": modes.${dim} leaves out the default value "${def.default}"`, {
        hint: `Include "${def.default}" or change modes.${dim}.default.`,
      });
    }
  }
}

/** The normalized IR restricted to a (validated) subset; unnamed dimensions keep every value. */
export function targetView(normalized, subset) {
  const dimensions = {};
  for (const [name, def] of Object.entries(normalized.dimensions)) {
    const kept = subset[name];
    dimensions[name] = kept ? { ...def, values: def.values.filter((v) => kept.includes(v)) } : def;
  }
  const allCombos = normalized.allCombos.filter((key) =>
    Object.entries(normalized.comboDims[key]).every(([d, v]) => dimensions[d].values.includes(v)),
  );
  const modes = {};
  const comboDims = {};
  for (const key of allCombos) {
    modes[key] = normalized.modes[key];
    comboDims[key] = normalized.comboDims[key];
  }
  // modes.light / modes.dark aliases: the primary dimension's kept values, every other dimension at its default.
  const primary = normalized.modeDimension;
  const others = Object.fromEntries(
    normalized.dimensionNames.filter((n) => n !== primary).map((n) => [n, dimensions[n].default]),
  );
  for (const v of dimensions[primary].values) {
    modes[v] = normalized.modes[comboKey(normalized.dimensionNames, { [primary]: v, ...others })];
  }
  return { ...normalized, modes, comboDims, allCombos, dimensions, modeValues: dimensions[primary].values };
}

/** Dimensions the subset cut down to one of several values (a deliberate exclusion, never a `dropped` row). */
export function narrowedDimensions(normalized, view) {
  return new Set(
    Object.entries(view.dimensions)
      .filter(([n, d]) => d.values.length === 1 && normalized.dimensions[n].values.length > 1)
      .map(([n]) => n),
  );
}

/** Appends to a target's `usage.md` the modes its files actually contain. */
export function withModesNote(contents, target, view) {
  const lines = Object.entries(view.dimensions).map(([n, d]) => `- \`${n}\`: ${d.values.join(', ')}`);
  return (
    contents.replace(/\n*$/, '\n') +
    `\n## Modes in these files\n\nThis target is generated for the subset of the project's modes set in \`targets.${target}.modes\`:\n\n${lines.join('\n')}\n\nValues left out are not emitted.\n`
  );
}
