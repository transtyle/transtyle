# Worklog — 2026-07-19 — OSS hygiene: LICENSE + community health files

**Audit items:** A1 (🔴, closed) and A6 (partially closed) from [docs/audit-2026-07.md](../audit-2026-07.md).

## What was done

1. **`LICENSE`** (new) — MIT, copyright "Julien Déramond and Transtyle contributors". Every `packages/*` manifest already declared `"license": "MIT"`; the file now actually exists, closing the "legal nonsense" flagged as A1.
2. **`SECURITY.md`** (new) — supported-versions statement (pre-1.0, `main` only), a short threat-model note grounded in the project's actual design constraints (build-time tool, no network, no executable config, zero-dep compiler packages; third-party plugins explicitly out of scope), and private reporting channels (GitHub private vulnerability reporting or maintainer email) with a 7-day acknowledgment commitment.
3. **`CODE_OF_CONDUCT.md`** (new) — Contributor Covenant v2.1, with enforcement contact set to the maintainer email.
4. **`CHANGELOG.md`** (new) — Keep a Changelog format; an *Unreleased* section that honestly inventories what exists on `main` today (core/ir/cli, three exporters, two examples, website). Notes that nothing is on npm yet and that IR/plugin-API are versioned separately per `docs/architecture/versioning.md`.
5. **`README.md`** — License section changed from "MIT (intended)" to a link to the real file.
6. **`docs/audit-2026-07.md`** — A1 marked done; A6 marked done except issue/PR templates (left open: those are best added together with the CI workflow / GitHub templates pass).

## Not done (deliberately)

- Issue/PR templates (rest of A6) — will land with the CI workflow (A2) so the `.github/` directory is introduced once, coherently.
- npm publication (A5) remains gated on A2 (CI) and A3 (tests).

## Sync-rule check (CONTRIBUTING.md)

- Code: n/a (no code touched).
- Specs: audit ledger updated.
- Website: n/a — no user-facing behavior change; the site does not render a license page.
- README: updated.
- Examples: n/a.
