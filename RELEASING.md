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
npx changeset publish --tag alpha
git push origin --follow-tags
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

> [!NOTE]
> **Landing on `0.1.0-alpha.0` exactly.** Packages currently sit at `0.1.0`, so the first versioned bump in pre mode produces `0.1.1-alpha.0` (patch) or `0.2.0-alpha.0` (minor) — not `0.1.0-alpha.0`. If the first published version should read `0.1.0-alpha.0`, set all 12 `version` fields to `0.0.0` before running `changeset version` the first time, and use a minor changeset. Nothing has been published, so nothing is lost by doing this. Otherwise, just accept the number Changesets picks — it is only a label.

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
   - Leave **dry run** checked the first time. It runs the full check suite, resolves the dist-tag, and packs every tarball without publishing.
   - Re-run with **dry run** unchecked to publish for real.

The workflow runs `npm run check:all` before it publishes anything, so a release cannot ship a build that fails its own guards.

### What consumers see

Alpha releases go to the `alpha` dist-tag, so the deliberate way in is:

```bash
npm install @transtyle/cli@alpha
```

> [!NOTE]
> npmjs.org auto-assigns `latest` on a package's very first publish regardless of `--tag`, and `latest` cannot be removed afterwards. So after the first alpha, a bare `npm install @transtyle/cli` will resolve to that first alpha and stay pinned there until a real release. This is a registry behaviour, not a promotion, and it is precisely why ADR-0010's freeze trigger is defined on the **version identifier** rather than on the dist-tag.

---

## Releasing a stable version

Read [The one rule](#the-one-rule-that-matters) again first. Then:

```bash
npx changeset pre exit      # leaves prerelease mode; commit the change
npx changeset version       # produces a version with no prerelease identifier
```

The workflow will now refuse to publish, by design. To go through with it, run the publish step with the confirmation set — deliberately, having decided that the catalog vocabulary is one you are willing to keep forever:

```bash
CONFIRM_STABLE_RELEASE=arm-the-freeze npx changeset publish --tag latest
```

The same release should update ADR-0010 and [ADR-0011](docs/adr/0011-v0-freeze-readiness.md) to record that the freeze is now armed, and drop the alpha banners from the README, the website layout and the docs index.

---

## Things that will surprise you

| Surprise                                                  | Why                                                                                                                                                                                    |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `check:release-tag` fails on a normal working tree        | It is a release gate, not a repo invariant, so it is deliberately **not** in `check:all`. On `main` between releases the packages sit at a stable version and it refuses. Expected.    |
| `changeset version` touches 45 files                      | Internal dependency ranges are rewritten everywhere, including private demo workspaces. Correct — see step 1 above.                                                                    |
| Selecting one package in `npm run changeset` bumps all 12 | The `fixed` group. Working as configured.                                                                                                                                              |
| A published package is missing a file                     | Each `package.json` has an explicit `files` allowlist. Three packages need more than `src`: both `surface-inventory.json` files and `plugin-kit`'s `fixture/` are read at **runtime**. |
| The publish job fails with an OIDC error                  | Almost always a mismatch between the npm trusted-publisher fields and reality — org, repo, workflow **filename**, or environment. All four are case-sensitive.                         |

---

## Security notes

This is a public repository. Everything in it is world-readable, including this file.

- **No tokens, ever.** Trusted publishing exists precisely so that no long-lived npm credential has to exist. Do not add an `NPM_TOKEN` secret "just in case" — an unused publish token is a standing liability, and the workflow does not read one.
- The publish job requests `id-token: write` (the OIDC exchange) and `contents: write` (pushing release tags) and nothing else. Both are scoped to that job, not the workflow.
- Actions are pinned by commit SHA with the version in a trailing comment. Keep it that way; a moving tag on a third-party action is a supply-chain hole in a job that can publish.
- If a token is ever pasted somewhere by accident, revoke it on npmjs.com first and clean up the history second. Revocation is what actually stops it.
