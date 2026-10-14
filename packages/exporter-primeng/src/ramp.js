/**
 * PrimeNG 11-step numeric ramp projector (docs/proposals/0002-component-theming-primeng.md
 * §2.2, §2.6). Same technique `@transtyle/exporter-radix` already proved for
 * Radix's 12 steps: pin named grid cells to numbered steps in lightness order,
 * fresh-mix the genuine gaps. Applied here to `primary.{50..950}` and
 * `surface.{0,50..950}` — PrimeNG's own two ramps (aura/base §2.2).
 *
 * 9 of 11 steps land on an existing grid cell (native); two steps (800, 900)
 * have no direct cell and are fresh `ctx.mix`es from solid-active toward
 * text-strong, at 0.5 and 0.75 (approximated). 900 does not pin `text`: the
 * standard derives `text` by walking from solid-active, so it lands on the same
 * lightness as 700 and would put 900 out of order. 700 <= 800 <= 900 <= 950
 * holds whenever solid-active is lighter than text-strong.
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
    950: get('text-strong'),
  };
  const solidActive = get('solid-active');
  const textStrong = get('text-strong');
  const mixed = (t) => (solidActive && textStrong ? ctx.mix(solidActive, textStrong, t) : undefined);
  cellFor[800] = mixed(0.5);
  cellFor[900] = mixed(0.75);

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
      class: n === 800 || n === 900 ? 'approximated' : 'native',
      slot: n === 800 || n === 900 ? '—' : `semantic.color.${role}.*`,
    });
  }
  return { ramp, coverage };
}
