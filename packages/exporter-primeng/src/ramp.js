/**
 * PrimeNG 11-step numeric ramp projector (docs/proposals/0002-component-theming-primeng.md
 * §2.2, §2.6). Same technique `@transtyle/exporter-radix` already proved for
 * Radix's 12 steps: pin named grid cells to numbered steps in lightness order,
 * fresh-mix the one genuine gap. Applied here to `primary.{50..950}` and
 * `surface.{0,50..950}` — PrimeNG's own two ramps (aura/base §2.2).
 *
 * 9 of 11 steps land on an existing grid cell (native); one step (800) has no
 * direct cell and is a fresh `ctx.mix` between its neighbors (approximated) —
 * a better native ratio than Radix's own 2-of-12 gap.
 */

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950'];

/** role: 'primary' | 'secondary' | ... any COLOR_ROLES member, or 'neutral' for the surface ramp. */
export function projectRamp(map, role, ctx, { includeZero = false } = {}) {
  const get = (cell) => map.get(`semantic.color.${role}.${cell}`)?.value;
  const cellFor = {
    50: get('tint'),
    100: get('tint-hover'),
    200: get('tint-active'),
    300: get('outline'),
    400: get('outline-hover'),
    500: get('solid'),
    600: get('solid-hover'),
    700: get('solid-active'),
    900: get('text'),
    950: get('text-strong'),
  };
  const solidActive = get('solid-active');
  const textStrong = get('text-strong');
  cellFor[800] = solidActive && textStrong ? ctx.mix(solidActive, textStrong, 0.5) : undefined;

  const ramp = {};
  const coverage = [];
  if (includeZero) {
    const zero = map.get('semantic.color.elevation.0.surface')?.value;
    if (zero) {
      ramp[0] = zero;
      coverage.push({ step: 0, class: 'native', slot: 'semantic.color.elevation.0.surface' });
    }
  }
  for (const step of STEPS) {
    const n = Number(step);
    const value = cellFor[n];
    if (!value) continue;
    ramp[n] = value;
    coverage.push({
      step: n,
      class: n === 800 ? 'approximated' : 'native',
      slot: n === 800 ? '—' : `semantic.color.${role}.*`,
    });
  }
  return { ramp, coverage };
}
