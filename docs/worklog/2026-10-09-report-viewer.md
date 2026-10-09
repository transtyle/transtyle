# A report viewer on the website (`/report/`)

Issue [#3](https://github.com/transtyle/transtyle/issues/3), audit finding E4.
Every build writes a `report.json` per target, and the only ways to read one
were the raw JSON and the terminal's one-line summary.

## What was built

- `/report/` (`website/src/pages/report/index.astro`): a report from a file
  (picked or dropped), a paste, a sample, `?sample=<example>.<target>` or
  `?src=<https URL>`, drawn as a header (target, `generatedBy`, options, files,
  and the catalog slots the target read when the report has `reads`),
  the coverage bar with the five counts, the CLI's percentages and its exact
  terminal line, the diagnostics grouped by severity with `file:line:column`
  (issue #157's locations) and hints, the `suppressed` list with each reason,
  and every row with its slot, the `slots` it reads and the `via` variables it
  follows (issue #177's fields, `via` linked to the row it names), its slot's
  `description` and `deprecated` reason when the report has them (#188),
  filterable by class and by text.
- Input is checked before anything is drawn, each case with its own message:
  empty, larger than 20 MB, invalid JSON (with line and column), not an object,
  a foreign or config `$schema`, a config without one, `transtyle check --json`
  output (named, since it is the JSON people have at hand), then the bundled
  `report/v0` schema with the first 20 `path: message` lines. A failed load
  hides the previous report rather than leaving it half replaced.
- Report text is untrusted (with `?src=` it comes from whoever wrote the link):
  the browser code builds nodes and sets text, never HTML
  (`website/src/report-dom.js`). `?src=` is fetched with credentials omitted and
  no referrer, `https:` only, and the host is printed above the report.
- Without JavaScript the page shows Acme's Bootstrap report, rendered at build
  time with the same markup the browser code draws.
- `@transtyle/core` exports `buildReport()` (`packages/core/src/report.js`), the
  function `compile()` already used privately. It now also adds the rows'
  `$description` / `$deprecated` metadata when given the IR (`normalized`), which
  `compile()` did next to the call. The site's 45 samples
  (`/report/samples/<example>.<target>.json`, from each example's config, so
  Acme's `shadcn-v3` is one) are `buildReport()` over an in-memory compile and
  are validated against the schema during `site:build`. One compile per example
  is shared with `demo-themes.js` (`website/src/compiled.js`).

## Measured

- All 45 samples are byte-identical to the `report.json` files
  `npx transtyle build --cwd examples/<id>` writes (compared with `cmp` after
  building the four examples).
- The viewer's terminal line equals the CLI's for `acme.bootstrap`
  (`bootstrap  8% native · 68% derived · 5% approximated · 10% dropped · 8% unsupported`)
  and `govuk.radix` (`radix  42% native · 58% approximated · 0% unsupported`).
- 49 browser checks (Playwright, Chromium): the inputs, the eleven error cases,
  a hostile `note` (`<img src=x onerror=…>`) shown as text, `?src=` success,
  404, blocked fetch and `http:`, keyboard order and the radio group's arrows,
  no horizontal scroll at 375 px, and the no-JavaScript render. A real
  cross-origin fetch from `raw.githubusercontent.com` works; `example.com`,
  which sends no CORS header, gets the "download it and open it here" message.
- The samples add 2.5 MB to the built site (Bootstrap's are 200 KB each), and the page's
  HTML is 528 KB, most of it the 714 Bootstrap rows rendered for readers without JavaScript.

## Findings

- A report keeps one `provenance` word per row, not the chain
  `transtyle explain` prints, and Radix's and PrimeNG's rows carry none. The
  viewer shows the word when there is one and, per row, the
  `transtyle explain --variable <name> --target <t>` command (issue #98) that
  prints the chain from the project. Rows that name no single variable
  (`(mode:density)`, PrimeNG's family summaries) get no command.
- `compile()` built each target's report inside the target loop, so a report
  listed only the diagnostics raised so far: an exporter diagnostic from a later
  target was missing from an earlier target's report. Reproduced with two
  in-process exporters and filed as
  [#186](https://github.com/transtyle/transtyle/issues/186); #201 fixed it on
  `main` while this branch was open, and the rebase keeps its after-the-loop
  report building, through `buildReport()`.
- The core README's example read `result.report`, which `compile()` never
  returned, and passed no `loadExporter`. It now builds a report with
  `buildReport()`.

## Deviations from the plan in the issue

- The footer link is in `astro.config.mjs` (the footer moved there with
  `@deramond.dev/astro`), not `Base.astro`.
- The site has one theme, dark, so there is no light-mode screenshot to take.
