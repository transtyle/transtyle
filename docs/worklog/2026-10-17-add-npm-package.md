# `transtyle add <npm package>`

Split from [#82](https://github.com/transtyle/transtyle/issues/82): declarative packages shipped in #213, and the command that installs a community exporter was the part still specced in the trust model.

## What was built

- `packages/cli/src/add-package.js`: the name check, the manifest read (`npm view`, or `tar -xzOf` for a local tarball, so no package code runs), the summary, the confirmation and the one `npm install --save-dev --ignore-scripts` call, all through `execFileSync` with an argument list.
- `cmdAdd` in `main.js`: an official name behaves as before; anything else goes through `addPackage`. `--yes` is accepted by `add` as well as `init`.
- `scripts/check-cli.mjs`: packed fixtures (a declarative package, a code package, an importer, a package without a manifest, a future IR spec) installed from tarballs offline. Covered: the refusals leave config and `package.json` untouched, a code package needs `--yes` without a terminal, both kinds build after being added.
- Specs and surfaces: `docs/specs/cli.md` (new `add` section), the trust model in `docs/architecture/plugins.md`, ADR-0017's last consequence, the website CLI, roadmap ledger and README, a changeset.

## Decisions

- A target is named after the manifest's `name` and its entry is `{ exporter: <package>, output: dist/<name> }`: the `exporter` field is the one configuration.md already defines, nothing new.
- Install scripts are off for every package, not only declarative ones. An exporter has no reason to need them, and its code still runs at build time, which the confirmation says.
- Deviation from the task text: the `irSpec`/`pluginApi` check (the TST1309 function) runs before the install, not after. The installed manifest must equal the shown one, so the verdict is identical and an incompatible package is never installed.
- The existing test that expected `add not-a-real-target` to exit 2 now uses a name that is not a valid npm name: a valid unknown name would go to the registry.
- A tarball path is accepted for offline tests and for reviewing a package privately; Windows runs `npm.cmd` through a shell, so there a spec must be plain path characters.

## Open

Whether a code package should ask on a terminal (built) or be refused without `--yes` and never asked.
