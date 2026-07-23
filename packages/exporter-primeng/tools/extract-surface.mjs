#!/usr/bin/env node
/**
 * AL3: extract PrimeNG's component-theming surface into a machine-readable
 * inventory — the PrimeNG twin of packages/exporter-bootstrap/tools/extract-surface.mjs.
 *
 * Source of truth is the real Aura preset object (`@primeuix/themes/aura`),
 * which IS PrimeNG's documented theming surface: every leaf under `semantic.*`
 * and `components.*` is a slot a preset author may override.
 *
 * Each leaf records how Aura itself supplies the value, because that decides
 * what "driven" means for this target — unlike Bootstrap's Sass, PrimeNG
 * resolves token references at runtime through its own semantic tier:
 *   - kind 'ref'     — value is `{semantic.path}`; if OUR emitted preset drives
 *                      that semantic path, the component slot follows our theme
 *                      even though we never mention the component.
 *   - kind 'literal' — a hardcoded value (padding, font weight, border width);
 *                      it stays Aura's unless we override the slot explicitly.
 *
 * Usage: node tools/extract-surface.mjs [--write]   (from packages/exporter-primeng)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');

const isRef = (v) => typeof v === 'string' && v.includes('{') && v.includes('}');
/** `'{content.border.color}'` -> `'content.border.color'` (first reference only). */
const refTarget = (v) => v.match(/\{([^}]+)\}/)?.[1] ?? null;

function walk(obj, prefix, out, group) {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      walk(v, path, out, group);
    } else {
      out.push({
        path,
        group,
        family: group === 'components' ? path.split('.')[0] : 'semantic',
        kind: isRef(v) ? 'ref' : 'literal',
        ...(isRef(v) ? { ref: refTarget(v) } : {}),
        value: typeof v === 'string' ? v : String(v),
      });
    }
  }
}

export async function extractSurface() {
  const mod = await import('@primeuix/themes/aura');
  const preset = mod.default ?? mod;
  const version = JSON.parse(
    readFileSync(join(repoRoot, 'node_modules', '@primeuix', 'themes', 'package.json'), 'utf8'),
  ).version;

  const slots = [];
  walk(preset.semantic ?? {}, '', slots, 'semantic');
  walk(preset.components ?? {}, '', slots, 'components');

  const families = {};
  for (const s of slots) families[s.family] = (families[s.family] ?? 0) + 1;
  const counts = {
    total: slots.length,
    semantic: slots.filter((s) => s.group === 'semantic').length,
    components: slots.filter((s) => s.group === 'components').length,
    refs: slots.filter((s) => s.kind === 'ref').length,
    literals: slots.filter((s) => s.kind === 'literal').length,
    componentFamilies: Object.keys(families).filter((f) => f !== 'semantic').length,
    families,
  };
  return {
    themesVersion: version,
    generatedBy: 'packages/exporter-primeng/tools/extract-surface.mjs',
    counts,
    slots,
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const inventory = await extractSurface();
  if (process.argv.includes('--write')) {
    const out = join(here, '..', 'surface-inventory.json');
    writeFileSync(out, JSON.stringify(inventory, null, 2) + '\n');
    console.log(
      `wrote ${out} (@primeuix/themes@${inventory.themesVersion}: ${inventory.counts.total} slots, ${inventory.counts.componentFamilies} component families)`,
    );
  } else {
    console.log(JSON.stringify(inventory.counts, null, 2).slice(0, 800));
  }
}
