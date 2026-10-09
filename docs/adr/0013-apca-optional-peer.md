# ADR-0013: APCA comes from the `apca-w3` package, an optional peer dependency of core

**Status:** accepted

## Context

`check.contrast.standard` accepted WCAG 2.1 AA and AAA. WCAG 2.1's ratio is known to misjudge light text on dark backgrounds, the case a dark-native system like Cathode lives in, so [BL-15](../backlog.md#bl-15) ([issue #92](https://github.com/transtyle/transtyle/issues/92)) asked for APCA as a selectable standard.

APCA's formula is published, but its reference code is not freely licensed. The `apca-w3` package (0.1.9, base algorithm 0.0.98G-4g, © Andrew Somers / Myndex, "Limited W3 License", patents pending) is licensed for web content in support of accessibility guidelines only, with every other use under AGPL v3. Its licence requires implementations to keep the essential code and constants unmodified "except as required to port to a given language", to stay on the latest non-breaking version, and allows the name "APCA" only for code that implements the current base algorithm correctly, including its polarity. A port inside `@transtyle/core` would ship that code under MIT, which those terms don't allow, and would make the project responsible for tracking it. The `colorparsley` package it depends on is AGPL v3.

[CONTRIBUTING.md](../../CONTRIBUTING.md) keeps `packages/*` zero-dependency and asks for an ADR-level justification before adding one to core.

## Decision

Core does not implement APCA. It declares `apca-w3` (`^0.1.9`) as an **optional peer dependency** and imports it only when a config selects APCA (`check.contrast.standard: "apca"`, or `derivation.contrast: "apca"`): from the project first, then from wherever core resolves packages. Installing Transtyle installs nothing more; a project that wants APCA runs `npm install --save-dev apca-w3`, and its licence applies to that install. A config that selects APCA without the package is an error (`TST1013`), never a silent fall back to WCAG.

- **One contrast object per standard** (`packages/core/src/contrast.js`): measure, magnitude, level by use, format. `check` (`TST2101`), `diff`'s contrast regressions and DERIVE's on-color picks all take it, so they can't disagree.
- **Levels by use, from APCA's Bronze simple mode**: Lc 75 for body text (`text.base` on the page surfaces), Lc 60 for other content text (`text.muted`, every `on-solid` and `on-tint`). Bronze defines no non-text level, and no non-text pair is checked under WCAG either.
- **Signed Lc.** Thresholds compare `|Lc|`; messages print the sign, as APCA requires.
- **Measured on the emitted 8-bit hex**, so a printed Lc matches what the reference implementation gives for the colors a target ships. `check:color` reproduces apca-w3's own eight test vectors to the last digit.
- **`derivation.contrast`** (`wcag21` | `apca`) sets the method on-colors are picked with. It defaults to the check standard's family, so a project checked under APCA is not warned about values the engine chose itself. The rule pack stays `standard@1` ([ADR-0010](0010-pre-release-breaking-changes.md)); WCAG output is byte-identical.
- The repository itself has `apca-w3` as a root dev dependency, pinned, so CI can test the APCA path.

## Alternatives not taken

- **A zero-dependency port in `color.js`.** Keeps `packages/*` free of any peer, but ships APCA's code under MIT against its licence, and leaves the project to track a moving algorithm it doesn't own.
- **Wait for WCAG 3.** APCA was removed from the WCAG 3 working draft in July 2023 and WCAG 3's contrast method is undecided. Waiting leaves dark-mode users with a check known to misjudge their case.
- **A regular dependency.** Every install would carry a package under a restrictive licence that most projects never use.

## Consequences

- `@transtyle/core`'s `package.json` gains `peerDependencies` / `peerDependenciesMeta` (optional). Core still installs with no dependency beyond `@transtyle/ir`; the zero-dependency rule now reads "no installed dependency", with this one opt-in exception.
- `TST1013` is appended. `check --json` gains `contrast: { standard, algorithm }`, the algorithm naming the apca-w3 version loaded.
- On-color contrast moved from DERIVE into `runChecks`' shared pair list, on resolved values: `wcag21-aaa` now applies to on-colors (it was 4.5:1 for them whatever the standard) and an authored on-color is checked (it never was).
- A future apca-w3 with a breaking change needs a new peer range and a review of this ADR. If APCA's licence or WCAG 3's method changes, this is the place to supersede.
