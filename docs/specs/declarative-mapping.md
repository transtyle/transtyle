# Declarative mapping format (v0)

> **Status: implemented** (`packages/core/src/declarative.js`, [ADR-0017](../adr/0017-declarative-exporters.md), [issue #82](https://github.com/transtyle/transtyle/issues/82)). Published schema: `website/public/schemas/mapping/v0.json` (`$id` `https://transtyle.dev/schemas/mapping/v0.json`), generated from `packages/core/src/schema/mapping.schema.js` by `npm run gen:schemas`.

A declarative mapping is a JSON table that is an exporter without code. Core's runtime reads it, resolves every row against the IR, writes the files and derives the coverage report from the rows.

## Pointing a target at a mapping

Two ways, and neither runs any code at build time:

- **A file next to the config.** The target's `exporter` is a relative (or absolute) path ending in `.json`, resolved against the project directory. `compile()` reads it itself, so programmatic callers get it without a loader.

  ```jsonc
  "targets": {
    "ourlib": { "exporter": "./ourlib.mapping.json", "output": "dist/ourlib" }
  }
  ```

- **An npm package.** Its `transtyle` manifest carries `"declarative": "<path inside the package>"`. The CLI's loader finds the package directory through the same `node_modules` lookup `require` uses, reads `package.json`, reads the mapping, and never imports `main`. The manifest is checked like any exporter's (`irSpec`, `pluginApi`: `TST1309`/`TST1310`), and its `targets` ranges serve `targets.<t>.version` ([versioning.md](../architecture/versioning.md#target-framework-versions-adr-0006)).

  ```json
  "transtyle": {
    "kind": "exporter",
    "name": "ourlib",
    "irSpec": "v0-draft",
    "pluginApi": "0",
    "declarative": "ourlib.mapping.json",
    "targets": { "ourlib": [">=2 <3"] },
    "modes": ["color-scheme"],
    "capabilities": ["build"]
  }
  ```

A mapping exporter takes no `options`: any `options` object on its target is `TST1011`.

## Shape

```jsonc
{
  "$schema": "https://transtyle.dev/schemas/mapping/v0.json",
  "name": "ourlib", // the exporter name: lowercase, dashes
  "description": "optional prose",
  "files": [
    {
      "path": "ourlib.css", // relative, no ".." segment
      "template": "css-custom-properties", // | "scss-variables" | "less-variables" | "json"
      "header": ["/* ourlib theme for {projectName}: generated, do not edit */"], // lines, verbatim
      "selector": ":root", // css only; default ":root"
      "mode": { "color-scheme": "light" }, // optional: the mode combination the file reads
      "blocks": [{ "mode": { "color-scheme": "dark" }, "selector": ".ourlib-dark" }], // css only
      "comments": "provenance", // optional: "/* derived · color */" after each line
      "rows": [
        { "variable": "--ourlib-brand", "slot": "semantic.color.primary.solid" },
        { "variable": "--ourlib-font", "slot": "semantic.type.role.body.md", "part": "fontFamily" },
        {
          "variable": "--ourlib-brand-hex",
          "slot": "semantic.color.primary.solid",
          "format": "hex",
        },
        {
          "variable": "--ourlib-tip",
          "slot": "component.tooltip.max-width",
          "note": "only when authored",
        },
      ],
    },
  ],
}
```

### Files and templates

| `template`              | A row is written as                       | `variable` must | `header`, `comments`      | `selector`, `blocks` |
| ----------------------- | ----------------------------------------- | --------------- | ------------------------- | -------------------- |
| `css-custom-properties` | `  --x: value;` in a block                | start with `--` | yes                       | yes                  |
| `scss-variables`        | `$x: value;`                              | start with `$`  | yes                       | no                   |
| `less-variables`        | `@x: value;`                              | start with `@`  | yes                       | no                   |
| `json`                  | `"x": "value"` (flat, `2`-space indented) | be non-blank    | no (JSON has no comments) | no                   |

`header` lines are written first, followed by one blank line; `{projectName}` (the config's `name`) is the only placeholder. Files are written in array order; every file ends with a newline.

### Rows

- **`variable`**, **`slot`** (required). `slot` is a `semantic.*` or `component.*` path. Rows are written in array order; a variable appears at most once per file.
- **`part`** picks a member of a composite value: `fontSize`, `fontWeight`, `lineHeight`, `fontFamily` of a `typography`; `color`, `width`, `style` of a `border`; `duration`, `delay`, `timingFunction` of a `transition`; `color`, `offsetX`… of a single `shadow`. A `typography` slot needs one (it has no single-value form); a slot whose catalog type has no members can't take one.
- **`format`** applies to every colour the row writes, the colours inside a shadow or border included: `oklch` (the default, `ctx.formatColor`), `hex` (`#rrggbb`, `ctx.formatHex`), `hsl-triplet` (`221 83% 53%`, `ctx.formatHslTriplet`).
- **`class`** is what the row claims when it resolves: `native` (default), `derived`, `approximated`. `dropped` and `unsupported` are the runtime's to give.
- **`note`** goes on the row's coverage item.

Values render the way `exporter-css-variables` renders them: colours through `format`; dimensions, durations, numbers and font weights as written; a font list comma-separated with names quoted where needed; a `cubicBezier` as `cubic-bezier(…)`; a shadow box-shadow-shaped (layers comma-separated); a border as `width style color` (none when its style is a dash-array object); a transition as `duration easing delay`.

### Modes

A file reads one mode combination: every dimension's default, overridden by `mode`. A CSS file may add `blocks`, each naming one value of one dimension and its selector:

- A block for the primary dimension (`color-scheme`) repeats **every colour-bearing row** (colour, shadow, border, gradient values), changed or not, so switching the scheme never leans on the base.
- A block for any other dimension (`density`…) holds only the rows whose value differs from the base.
- A block whose mode value the design system doesn't have (`dark` in a light-only system) is left out, and so is a file whose `mode` it doesn't have (its rows are `dropped`, saying so): one mapping serves systems with and without the mode. A dimension the design system doesn't declare at all (`colour-scheme`) is a mistake, `TST1014`.

For a Sass, Less or JSON file, write one file per mode value with `mode`. A mode dimension with more than one value that no file `mode` and no block names gets a `(mode:<dimension>)` row classed `dropped`, as [validation-and-coverage.md](validation-and-coverage.md#coverage-report) requires of any target that can't express it.

## Coverage

One coverage item per variable, from the first row that writes it (a variable written in two files is one item):

| The row's slot…                                                                      | `class`                                 | `note`                                                             |
| ------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------ |
| has no value in this design system                                                   | `dropped`                               | the row's `note`, or "the slot has no value in this design system" |
| has a value with no single-value form (`part` missing, a dash-array border)          | `dropped`                               | the row's `note`, or why                                           |
| resolved, and a `hex`/`hsl-triplet` colour was clamped into sRGB in any mode written | `approximated`                          | `sRGB gamut clamp (<format>)`                                      |
| resolved                                                                             | the row's `class` (`native` by default) | the row's `note`                                                   |

`provenance` is the slot's (`authored`, `aliased`, `derived`, `defaulted`), as every exporter reports it.

## Validation

Before any `emit`, `compile()` checks the mapping and refuses the target (other targets are still checked; nothing is written):

- **`TST1014`** (error): the file can't be read or isn't JSON; it fails the schema; or what the schema can't say — a `variable` that doesn't fit its template, a `variable` written twice in one file, `selector`/`blocks` outside a CSS file, `header`/`comments` in a JSON file, a block naming more than one dimension, a file or block `mode` naming a dimension the design system doesn't declare, a selector containing `{` or `}`, a `part` on a slot whose catalog type has no members, a `typography` slot without one. One diagnostic per problem, each with the path (`files[0].rows[7].variable`).
- **`TST1015`** (error): a row whose `slot` is neither a catalog slot nor a path of this design system (custom roles and authored component tokens are), with the nearest known slot as a hint.

## Not in v0

Conditions, expressions, value arithmetic, naming patterns (`{role}`), wildcard rows, per-version tables. That is where a mapping graduates to code: the exporter guide's Alacritty theme ([write-an-exporter.md](../../website/src/docs/write-an-exporter.md)) is the worked example on the code side of the line.

## Conformance

`createDeclarativeExporter(mapping)` (exported by `@transtyle/core`) returns a plain `{ name, emit }`, so `conformance()` runs it like any plugin. `check:plugins` runs two: the reference mapping, which reproduces `exporter-css-variables`' stylesheet on plugin-kit's canonical fixture byte for byte with the same coverage rows (generated from css-variables' own coverage by `npm run gen:reference-mapping`, `packages/core/test-fixtures/declarative/reference.mapping.json`), and the package fixture's mapping with its manifest.
