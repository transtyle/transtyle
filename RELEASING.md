# Releasing Transtyle

How versions are decided, cut and published. Written for maintainers; nothing here is secret, and nothing here should ever become secret — see [Security notes](#security-notes) at the end.

Versioning and changelogs are managed by [Changesets](https://changesets.dev). Publishing runs from GitHub Actions using npm [trusted publishing](https://docs.npmjs.com/trusted-publishers/), so **there is no npm token anywhere** — not in the repo, not in Actions secrets, not on a laptop that pushes releases.

---

## The one rule that matters

> [!CAUTION]
> **Publishing a version with no prerelease identifier arms the catalog freeze, permanently.**
>
> [ADR-0010](docs/adr/0010-pre-release-breaking-changes.md), as amended, lets the semantic catalog change in place — slots renamed, removed, re-typed — for as long as every released version carries an `-alpha.N` (or other prerelease) identifier. The first release cut _without_ one ends that. From then on the catalog is additive-only: nothing removed, nothing re-typed, rule semantics only via a new rule-pack version.
>
> Unpublishing does not undo it. People will have installed it.

This is why [`scripts/check-release-tag.mjs`](scripts/check-release-tag.mjs) refuses a non-prerelease publish unless you set `CONFIRM_STABLE_RELEASE=arm-the-freeze`. The guard is not bureaucracy — it is the only thing between a routine `Run workflow` click and a one-way door.

Check where you stand at any time:

```bash
npm run check:release-tag
```

---

## One-time setup

Steps 1–2 have been done. Steps 3–4 are needed before the workflow can publish.

### 1. npm organization ✅

The `transtyle` org on npm owns the `@transtyle/*` scope. All 12 publishable packages are scoped to it.

### 2. Repository ✅

`github.com/transtyle/transtyle`. Every package declares this in its `repository` field, which npm matches when attaching provenance.

### 3. The first publish cannot use trusted publishing

npm will not let you configure a trusted publisher for a package that does not exist yet — the setting lives on the package's own settings page. With 12 never-published packages, that is a chicken-and-egg problem, and it has exactly one honest resolution: **the first release of each package is published from a laptop, and every release after that runs from CI.**

```bash
npm login                    # your own account; must be a member of the transtyle org
npm whoami                   # confirm
```

Then cut the first alpha exactly as described in [Releasing an alpha](#releasing-an-alpha) below, but run the publish locally instead of through the workflow:

```bash
npm run check:release-tag    # must print the alpha dist-tag before you continue

# Publish all 12 under that tag, in dependency order. No --access flag is
# needed: every package carries publishConfig.access = public.
# One command rather than a shell loop, so it works in bash, zsh and fish alike.
npm publish --tag alpha -w packages/ir -w packages/core -w packages/exporter-shadcn -w packages/exporter-echarts -w packages/exporter-daisyui -w packages/exporter-bootstrap -w packages/exporter-storybook -w packages/exporter-css-variables -w packages/exporter-radix -w packages/exporter-primeng -w packages/plugin-kit -w packages/cli

v=$(node -p "require('./packages/core/package.json').version")
git tag -a "v$v" -m "v$v" && git push origin "v$v"
```

That first publish will not carry a provenance attestation, because provenance requires the OIDC path. Every later release will. This is a known and accepted one-time gap; it is not worth publishing throwaway `0.0.0` placeholder packages to avoid.

> [!NOTE]
> Requires npm ≥ 11.5.1 locally if you want the same CLI as CI (`npm install -g npm@latest`). If the org enforces 2FA for publishing, npm will prompt for a one-time password. Never pass an OTP or a token on a command line you then paste into an issue.

### 4. Configure trusted publishing for all 12 packages

Once the packages exist on npm, for **each** of `@transtyle/{cli,core,ir,plugin-kit,exporter-bootstrap,exporter-css-variables,exporter-daisyui,exporter-echarts,exporter-primeng,exporter-radix,exporter-shadcn,exporter-storybook}`:

npmjs.com → the package → **Settings** → **Trusted publisher** → GitHub Actions, then:

| Field             | Value                |
| ----------------- | -------------------- |
| Organization      | `transtyle`          |
| Repository        | `transtyle`          |
| Workflow filename | `release.yml`        |
| Environment       | `release` (optional) |

> [!WARNING]
> Every field is case-sensitive and exact, the workflow field is the **filename only** (not a path), and npm validates none of it when you save. A typo surfaces only as a failed publish months later.

If you fill in the Environment field, the GitHub environment of the same name must exist and the workflow must run in it — [`release.yml`](.github/workflows/release.yml) already declares `environment: release`. That environment is also the right place to add required reviewers if you ever want a second pair of eyes on a publish.

---

## Everyday: writing a changeset

A changeset is a small file describing what changed and how it should bump the version. Add one in the same PR as the change:

```bash
npm run changeset
```

It asks which packages changed and whether the bump is patch/minor/major, then writes a markdown file to `.changeset/`. Commit it. Several changesets accumulate between releases and are consumed together.

> [!IMPORTANT]
> **Changesets versions the packages; it does not publish them.** `changeset publish` refuses `--tag` while in pre mode, and with no tag it sends an alpha series to `latest` from the second release onward — once every published version is a prerelease it classifies the package as `only-pre` and falls back to `latest`, which would strand the `alpha` tag on `alpha.0` and point bare `npm install` at each new alpha. So publishing is plain `npm publish --tag <tag>` per package, using the tag [the release guard](scripts/check-release-tag.mjs) resolved. Use `npx changeset version`, never `npx changeset publish`.

Two things about this repo specifically:

- **All 12 packages move together.** `.changeset/config.json` puts `@transtyle/*` in one `fixed` group, so they always share a version number. Selecting one package in the prompt still bumps all of them. This is deliberate: the CLI depends on all eight exporters, and a matrix of independently-versioned compiler parts is not a debugging experience anyone wants.
- **Private workspaces are not versioned** (`privatePackages: { version: false }`), so the website and the 32 demo projects never get version numbers of their own.

Changes that need no changeset: docs, CI, tests, anything that does not alter a published package.

---

## Releasing an alpha

This is the current mode. The repo enters prerelease mode once and stays there for the whole alpha series.

### Entering prerelease mode (once per series)

```bash
npx changeset pre enter alpha
```

This writes `.changeset/pre.json`. Commit it. From now on `changeset version` produces `-alpha.N` versions and the guard resolves the dist-tag to `alpha`.

### How the alpha numbering works

The alpha series is `0.1.0-alpha.0`, `0.1.0-alpha.1`, `0.1.0-alpha.2`, … — the base version stays put and only the counter moves, for the whole run up to beta.

That falls out of how pre mode works rather than needing to be enforced. Changesets recomputes each version from the versions recorded at `pre enter`, applying the **highest bump across every changeset in the series**. Once one `minor` is in the series, later `patch` and `minor` changesets cannot move the base any further, so every subsequent release only increments the counter.

Getting the series started (one time, before the first release):

```bash
# 1. Rebase the 12 packages to 0.0.0 — nothing is published, so nothing is lost.
#    website/package.json is deliberately NOT touched; see the note below.
# 2. Enter pre mode, which records those 0.0.0 versions as the series baseline.
npx changeset pre enter alpha
# 3. Make the first changeset a `minor` one. 0.0.0 + minor = 0.1.0 → 0.1.0-alpha.0.
```

> [!WARNING]
> **One `major` changeset rebases the entire series to `1.0.0-alpha.N`.** The base is the highest bump seen since `pre enter`, so a single major bump in any PR moves it permanently for the rest of the run. `scripts/check-release-tag.mjs` refuses to publish a `>=1.0.0` prerelease for this reason — reaching 1.0 should be a decision, not a side effect of a bump type chosen in a PR. Use `minor` for breaking changes during the alpha; that is what the ADR-0010 exemption is for.

> [!NOTE]
> **`@transtyle/website` is excluded from the `fixed` group on purpose.** It is private and never published, but it is scoped `@transtyle/*` and carries its own `0.1.0`, and the fixed group takes the **highest** version in the group as its base — so leaving it in silently added a minor bump to every release. The group is declared as `["@transtyle/*", "!@transtyle/website"]`. Any future private package under the scope needs the same treatment.

### Cutting each alpha release

1. **Version the packages.**

   ```bash
   npx changeset version
   ```

   This consumes the `.changeset/*.md` files, bumps all 12 packages, and writes `CHANGELOG.md` in each.

   Expect a large diff. Changesets rewrites internal dependency ranges from `"*"` to the exact new version — in the 12 packages **and** in every private workspace that consumes them, which is 33 more files. That is correct and wanted: `"*"` published as-is would let `@transtyle/cli@0.1.0-alpha.0` install any future `@transtyle/core`, which during an alpha is a guaranteed break.

2. **Review and commit.** Read the generated changelogs — they are the release notes.

   ```bash
   npm run check:release-tag   # sanity: should report the alpha dist-tag
   git add -A && git commit -m "release: 0.1.0-alpha.N"
   git push origin main
   ```

3. **Publish.** GitHub → Actions → **Release** → **Run workflow**.
   - Leave **dry run** checked the first time. It runs the full check suite, resolves the dist-tag, and packs every tarball — the same `npm publish` command as a real release, with `--dry-run` added and nothing else changed.
   - Re-run with **dry run** unchecked to publish for real.

   > [!IMPORTANT]
   > **A green dry run does not prove trusted publishing works.** Nothing is published, so the OIDC exchange never happens and the npm trusted-publisher configuration is never exercised. The first real publish is the only test of it. If it is misconfigured, that publish fails at the publish step having changed nothing on the registry, and you can fall back to publishing locally while you fix the settings.

The workflow runs `npm run check:all` before it publishes anything, so a release cannot ship a build that fails its own guards.

### What consumers see

Alpha releases go to the `alpha` dist-tag, so the deliberate way in is:

```bash
npm install @transtyle/cli@alpha
```

> [!NOTE]
> **How `latest` behaves, and why.** npmjs.org auto-assigns `latest` on a package's very first publish regardless of `--tag`, and it cannot be removed afterwards. Rather than fight that, the policy leans into it: **while no stable release exists, `latest` tracks the newest alpha.** A bare `npm install @transtyle/cli` therefore installs the current alpha rather than being stranded on whichever prerelease happened to be published first.
>
> `npm publish --tag` sets only one tag, so [`scripts/sync-latest-tag.mjs`](scripts/sync-latest-tag.mjs) runs after the publish and moves `latest` too. It decides per package by reading the registry: if the current `latest` carries a prerelease identifier, no stable release has taken over and `latest` is still the alpha's to move. **The first stable release repoints `latest` to itself, and from that moment the script leaves it alone permanently** — prereleases never move `latest` again, and `@alpha` becomes the opt-in channel it is meant to be. There is no flag to remember; the registry state is the switch.
>
> This is also why ADR-0010's freeze trigger is defined on the **version identifier** rather than on the dist-tag: `latest` legitimately points at a prerelease during the alpha, so a tag-based trigger would be meaningless.

---

## Releasing a stable version

Read [The one rule](#the-one-rule-that-matters) again first. Then:

```bash
npx changeset pre exit      # leaves prerelease mode; commit the change
npx changeset version       # produces a version with no prerelease identifier
```

The workflow will now refuse to publish, by design. To go through with it, run the publish step with the confirmation set — deliberately, having decided that the catalog vocabulary is one you are willing to keep forever:

```bash
CONFIRM_STABLE_RELEASE=arm-the-freeze npm run check:release-tag
npm publish --tag latest -w packages/ir -w packages/core -w packages/exporter-shadcn -w packages/exporter-echarts -w packages/exporter-daisyui -w packages/exporter-bootstrap -w packages/exporter-storybook -w packages/exporter-css-variables -w packages/exporter-radix -w packages/exporter-primeng -w packages/plugin-kit -w packages/cli
```

The same release should update ADR-0010 and [ADR-0011](docs/adr/0011-v0-freeze-readiness.md) to record that the freeze is now armed, and drop the alpha banners from the README, the website layout and the docs index.

---

## Things that will surprise you

| Surprise                                                                                | Why                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:release-tag` fails on a normal working tree                                      | It is a release gate, not a repo invariant, so it is deliberately **not** in `check:all`. On `main` between releases the packages sit at a stable version and it refuses. Expected.    |
| `changeset version` touches 45 files                                                    | Internal dependency ranges are rewritten everywhere, including private demo workspaces. Correct — see step 1 above.                                                                    |
| Selecting one package in `npm run changeset` bumps all 12                               | The `fixed` group. Working as configured.                                                                                                                                              |
| An alpha release jumps to `1.0.0-alpha.N`                                               | A `major` changeset landed and rebased the series. The release guard blocks it; downgrade the changeset to `minor` and re-run `changeset version`.                                     |
| `changeset publish` errors with "Releasing under custom tag is not allowed in pre mode" | Expected — it is not the publish command here. Use the `npm publish -w … --tag` loop above.                                                                                            |
| A published package is missing a file                                                   | Each `package.json` has an explicit `files` allowlist. Three packages need more than `src`: both `surface-inventory.json` files and `plugin-kit`'s `fixture/` are read at **runtime**. |
| The publish job fails with an OIDC error                                                | Almost always a mismatch between the npm trusted-publisher fields and reality — org, repo, workflow **filename**, or environment. All four are case-sensitive.                         |

---

## Security notes

This is a public repository. Everything in it is world-readable, including this file.

- **No tokens, ever.** Trusted publishing exists precisely so that no long-lived npm credential has to exist. Do not add an `NPM_TOKEN` secret "just in case" — an unused publish token is a standing liability, and the workflow does not read one.
- The publish job requests `id-token: write` (the OIDC exchange) and `contents: write` (pushing release tags) and nothing else. Both are scoped to that job, not the workflow.
- Actions are pinned by commit SHA with the version in a trailing comment. Keep it that way; a moving tag on a third-party action is a supply-chain hole in a job that can publish.
- If a token is ever pasted somewhere by accident, revoke it on npmjs.com first and clean up the history second. Revocation is what actually stops it.
