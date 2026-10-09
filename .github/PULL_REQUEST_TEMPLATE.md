<!-- What changed and why, in a few sentences. -->

Closes #

## Checklist

See [CONTRIBUTING.md](../CONTRIBUTING.md). Tick what applies and say why for what does not.

- [ ] `npm run check:all` passes (it includes `check:sync`)
- [ ] Sync rule: code, specs (`docs/`), website (`website/src/docs/`), README and examples agree
- [ ] Changeset added with `npm run changeset` for any change to a published `packages/*`, no hand-edited `version` ([RELEASING.md](../RELEASING.md))
- [ ] Generated files regenerated (`gen:schemas`, `gen:brand`, `gen:figures`), not hand-edited
- [ ] `packages/*` stay zero-dependency, and new diagnostic codes are appended and documented in `website/src/docs/diagnostics.md`
- [ ] `npm run site:build` passes for website changes, with screenshots
