---
title: "Write an exporter"
description: "Build a third-party exporter from zero and prove it with the conformance kit."
order: 23
---

# Write an exporter

The core knows nothing about any target. Every official exporter — Bootstrap, shadcn/ui, PrimeNG — uses the same public API you're about to use, and nothing in this guide touches core.

We'll build a real one: compile a design system into an **Alacritty terminal colour scheme**. It's small enough to read in one sitting and awkward enough to be honest — a terminal has 16 colours and no concept of radius, spacing, or type, so you'll have to say what doesn't fit.

<div class="callout"><div class="callout-title">Before npm publication</div>

Transtyle isn't on npm yet, so the install steps below use a local path to a clone. Once packages are published, the same steps work with `npm install @transtyle/plugin-kit`. Nothing else in this guide changes.
</div>

## The whole API

One function. It receives the fully resolved design system and returns files plus an honest account of how well they map:

```ts
{
  name: string,
  emit(ir, ctx) → { files: [{ path, contents, kind }], coverage: [...] }
}
```

That's it. No build step, no framework, no registration ceremony. Three rules the [conformance kit](#4-prove-it) enforces: `emit` must be **deterministic**, it must **not mutate** the IR, and it must never touch the filesystem — you return file *descriptions*, core writes them.

## 1. Set up the package

```bash
mkdir transtyle-exporter-alacritty && cd transtyle-exporter-alacritty
npm init -y
npm install @transtyle/plugin-kit    # while unpublished: npm install /path/to/transtyle/packages/plugin-kit
```

Your `package.json` carries a `transtyle` manifest — static metadata that tools can read *without executing your code*, which is what makes `transtyle add` and any future registry safe:

```json
{
  "name": "transtyle-exporter-alacritty",
  "type": "module",
  "exports": { ".": "./src/index.js" },
  "keywords": ["transtyle-exporter"],
  "transtyle": {
    "kind": "exporter",
    "name": "alacritty",
    "irSpec": "v0-draft",
    "pluginApi": "0",
    "targets": { "alacritty": ["*"] },
    "modes": ["color-scheme"],
    "capabilities": ["build"]
  }
}
```

The `transtyle-exporter` keyword is how community exporters are discoverable.

## 2. Write the mapping table

Keep the mapping as **data**, separate from the code that renders it. Yours is the only code that reads it, so the shape is up to you — but a flat table is what makes an exporter reviewable by someone who knows the target and not the compiler.

Alacritty wants eight "normal" and eight "bright" ANSI colours. The [role grid](/docs/language/#color-roles-the-role-grid) supplies both from the same roles: `solid` for normal, `solid-hover` for bright. That is exactly what the grid's state axis is for.

```js
const ANSI = [
  { name: 'black',   slot: 'neutral.solid',  class: 'approximated', note: 'ANSI black is a palette slot, not a surface' },
  { name: 'red',     slot: 'danger.solid',   class: 'native' },
  { name: 'green',   slot: 'success.solid',  class: 'native' },
  { name: 'yellow',  slot: 'warning.solid',  class: 'native' },
  { name: 'blue',    slot: 'primary.solid',  class: 'native' },
  { name: 'magenta', slot: 'accent.solid',   class: 'approximated', note: 'no magenta concept in the catalog; accent is the closest intent' },
  { name: 'cyan',    slot: 'info.solid',     class: 'native' },
  { name: 'white',   slot: 'text.base',      class: 'approximated', note: 'ANSI white is a foreground' },
];
```

Note the `class` on each row. **You** decide how honest each mapping is, because only you know the target: `native` where it really means what we mean, `approximated` where you bent a meaning to fit. Don't be shy about `approximated` — the [coverage report](/docs/concepts/#5-provenance-and-coverage) is the product's credibility, and a wall of green nobody believes is worth less than an amber row with a reason.

## 3. Write `emit`

```js
const S = 'semantic.color.';

export default {
  name: 'alacritty',

  // Core validates the user's `options` against this before calling you.
  optionsSchema: {
    type: 'object',
    additionalProperties: false,
    properties: { mode: { type: 'string' } },
  },

  emit(ir, ctx) {
    // Terminals have no light/dark switch — you compile one mode.
    const mode = ctx.targetConfig.options?.mode ?? ir.defaultMode;
    const map = ir.modes[mode] ?? ir.modes[ir.defaultMode];
    const coverage = [];

    // ctx carries the colour helpers. Never convert colours yourself.
    const hex = (slot) => {
      const entry = map.get(S + slot);
      return entry ? ctx.formatHex(entry.value).text : null;
    };

    const row = (variable, slot, cls, note) => {
      const value = hex(slot);
      if (value === null) {
        coverage.push({ variable, slot: S + slot, class: 'unsupported', note: 'slot missing from the IR' });
        return null;
      }
      coverage.push({
        variable, slot: S + slot, class: cls,
        provenance: map.get(S + slot).provenance.kind,
        ...(note && { note }),
      });
      return value;
    };

    const fg = row('colors.primary.foreground', 'text.base', 'native');
    const bg = row('colors.primary.background', 'elevation.0.surface', 'native');
    const normal = ANSI.map((a) => [a.name, row(`colors.normal.${a.name}`, a.slot, a.class, a.note)]);
    const bright = ANSI.map((a) => [
      a.name,
      row(`colors.bright.${a.name}`, `${a.slot}-hover`, a.class, 'bright variant from the grid’s hover state') ?? hex(a.slot),
    ]);

    // Say plainly what this target cannot express.
    for (const missing of ['radius.*', 'space.*', 'type.*', 'elevation.*.shadow']) {
      coverage.push({ variable: `(${missing})`, slot: '—', class: 'dropped', note: 'Alacritty themes carry colour only' });
    }

    const toml = [
      `# Generated by transtyle from ${ctx.projectName} (${mode} mode) — do not edit.`,
      '', '[colors.primary]',
      `background = "${bg}"`,
      `foreground = "${fg}"`,
      '', '[colors.normal]', ...normal.map(([k, v]) => `${k} = "${v}"`),
      '', '[colors.bright]', ...bright.map(([k, v]) => `${k} = "${v}"`),
      '',
    ].join('\n');

    return {
      files: [{ path: 'alacritty.transtyle.toml', contents: toml, kind: 'config' }],
      coverage,
    };
  },
};
```

Three things worth pointing at:

- **`ctx` gives you the colour helpers** — `formatHex`, `formatColor`, `formatHslTriplet`, `contrastRatio`, `mix`. Use them. They're the same functions the derivation engine uses, so your output agrees with everyone else's by construction.
- **A missing slot is data, not a crash.** If the IR has no `accent.solid`, record `unsupported` and carry on. Never throw because a design system didn't author something.
- **The dropped rows are the point.** A terminal can't express radius or type. Saying so, in the report, is the difference between a translation and a guess.

## 4. Prove it

The conformance kit is the real specification — prose drifts, executable fixtures don't. Point it at your plugin:

```js
// conformance.test.mjs
import { conformance } from '@transtyle/plugin-kit';
import { readFileSync } from 'node:fs';
import plugin from './src/index.js';

const manifest = JSON.parse(readFileSync('./package.json', 'utf8')).transtyle;
const { pass, checks } = await conformance(plugin, { manifest });

for (const c of checks) console.log(`${c.pass ? '✔' : '✖'} ${c.name}${c.pass ? '' : ` — ${c.detail}`}`);
if (!pass) process.exit(1);
```

```bash
node conformance.test.mjs
```

```
✔ interface-shape      ✔ emit-returns-coverage   ✔ ir-immutable
✔ emit-runs            ✔ coverage-classes-valid  ✔ manifest-valid
✔ emit-returns-files   ✔ deterministic           ✔ options-schema-shape
```

The kit runs your plugin against a canonical fixture design system, twice, and checks the contract — including that you didn't mutate the IR and that two runs are byte-identical. Passing it is what "official" means, and community exporters can advertise it.

## 5. Use it in a real project

Install it into a project and name it in the config. The `exporter` field selects the package; the key is the instance name:

```bash
npm install transtyle-exporter-alacritty
```

```json
"targets": {
  "alacritty": {
    "exporter": "transtyle-exporter-alacritty",
    "output": "dist/alacritty"
  }
}
```

```bash
npx transtyle build alacritty
```

```
alacritty  55% native · 23% approximated · 18% dropped · 5% unsupported
  ↳ dist/alacritty/alacritty.transtyle.toml
  ↳ dist/alacritty/report.json
```

That coverage line is your exporter being honest in public — and `dist/alacritty/alacritty.transtyle.toml` is a terminal theme built from the same tokens as your buttons.

## Where next

- [The Transtyle language](/docs/language/) — every catalog slot you can map from, and which exporters consume each
- [Internals](/docs/internals/) — the pipeline your `emit` sits at the end of
- [css-variables](/docs/exporter-css-variables/) — the reference implementation, deliberately trivial, worth reading start to finish
