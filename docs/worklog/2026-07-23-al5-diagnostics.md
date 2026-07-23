# AL5 — the diagnostics polish pass

The ledger entry said to judge "genuinely good to use" by what happens when the user does something wrong, not by the happy path. So the pass started by building a three-token design system in a scratch directory and making mistakes in it: a typo'd config key, an unknown target, a dangling alias, an alias cycle, malformed JSON, an unparseable color, a glob that matches nothing, a brand color authored one path off.

The most useful thing it found is that the worst failure wasn't a mistake at all.

## The floor was broken

A design system that authors only a brand color, a surface, and a text color is legal. Nothing requires a radius scale. `transtyle build bootstrap` answered it with:

```
✖ Cannot read properties of undefined (reading 'value')
```

No code, no slot name, no hint, no output, no non-zero information of any kind. Two other exporters wrote the literal string `undefined` into their stylesheets instead.

Three distinct defects underneath, all of the same shape — **code that assumes a slot exists because it exists in the examples**:

1. **`derive.js` materialized component slots with `value: undefined`.** A catalog `defaultFrom` whose source doesn't resolve has no default to give, but the slot was created anyway, carrying `provenance: derived` — which reads as "covered" to every exporter and to the coverage report. `component.button.radius` existed, with no value, and would have emitted `$btn-border-radius: undefined;`. Now the slot is simply absent, which is the truthful state.
2. **Type-role composites carried `fontFamily: undefined`.** Authoring no font stack produced 18 `--type-role-*-family: undefined;` declarations in `css-variables`. Members that don't resolve are now omitted from the composite rather than present-and-undefined.
3. **Exporters read recipe sources without checking.** Bootstrap's `resolveEmits` threw; the fix reports an honest coverage row instead, naming the slot to author. `css-variables` stringified undefined members. Bootstrap's global tier had a third variant (`semantic.color.border` is _aliased_ in all four examples, never derived, so a minimal system has none) — a declaration whose value doesn't resolve is now dropped, with a coverage row, and the target's own default stands.

Not one existing check could see any of it. `check:fixtures`, `check:coverage-bar` and `check:bootstrap-surface` all run against the four examples, and every example authors a complete token set — precisely the shape that hides this.

**`check:minimal-ds`** (new, in `check:all`, now 62 checks) compiles a three-token design system against all 8 exporters and asserts none throws, none emits an empty file, and none leaks `undefined`/`null`/`NaN` into output. Both failure modes verified by reintroducing the real defects: the crash surfaces as `bootstrap: threw instead of reporting`, the leak as 18 located lines.

## Messages that sent users the wrong way

**`TST1201` blamed the wrong thing.** It read `semantic.color.primary.solid is required (config derivation.require).` — but the most likely way to hit it is authoring `semantic.color.primary` instead of `…primary.solid`, in a config that has no `derivation.require` at all. It is an engine invariant, not a config consequence. The text now says what's missing and why nothing can invent it, and the hint names the exact path and the exact near-miss.

**`TST1201` also printed above its own cause.** It was raised inside DERIVE, which runs _before_ deferred aliases resolve, so a dangling `{semantic.color.brand}` was diagnosed afterwards and the user's eye landed on the symptom. The check moved to `compile()`, after all alias resolution, where it can both see the root cause and stay silent when there is one (`TST1002`/`TST1104`/`TST1105`/`TST1106`).

**`TST1010` rendered as `targts unknown property "targts"`** — the path prefixed onto a message that already named the key. Fixed, and near-miss keys now get `did you mean "targets"?`, which is the entire fix in the common case.

**`TST1301` gave a dead end.** `Target "daisyui" is not configured` while holding the list of what _is_ configured. It now distinguishes the two different mistakes that reach it: a typo gets the near name plus the configured list, and a correctly-spelled exporter that just isn't in this config gets told to add it. Core stays exporter-agnostic — the CLI passes its own `OFFICIAL_EXPORTERS` keys in as `knownExporters`.

**`TST1104` lied about its own fallout.** A cycle returned `undefined` from the resolver, so the caller then reported `TST1105 Dangling alias` for every token in the loop — false, since the target exists and merely loops. A distinct `CYCLE` sentinel stops that. The same cycle was also reported once per entry point, with the chain rotated: two message strings for one mistake, which message-level de-duplication can't catch, so cycles are now keyed on their sorted member set.

**`TST2101` didn't say why.** Dark-mode contrast warnings on a system with no dark values authored are about colors the user never wrote. When a color is byte-identical to the default mode's and `autoDark` is off, the hint now says exactly that.

**`TST1002` printed an absolute path**, burying the filename behind a long prefix; now relative to the project. **`TST1001`** says where it looked.

## The structural changes

- **`hint` is a first-class diagnostic field**, rendered by the CLI on its own `↳` line and declared in the report schema. Keeping it out of `message` is what makes actionability structural rather than a matter of longer sentences: what is wrong and what to change are different sentences, and consumers (editors, CI annotations) want to place them differently. The advice on the docs page mostly already existed — it just wasn't reaching anyone at the moment of failure.
- **De-duplication on (severity, code, message).** NORMALIZE and DERIVE run once per mode combination, so one authoring mistake was reported once per combination. A two-token alias cycle printed **twelve** lines; it now prints one. Genuinely per-mode diagnostics name their mode, so they still come through separately.
- **`nearestName`** (shared, in core) backs all three "did you mean" sites — config key, target instance, and `explain`'s slot lookup, which already had its own copy.

## Before / after

A two-token alias cycle:

```
- 12 lines: 4x TST1104 (rotated) + 8x TST1105 (false "dangling")
+  1 line:  TST1104 with the chain, plus a hint
```

Authoring `semantic.color.primary` instead of `primary.solid`:

```
- ✖ TST1201 semantic.color.primary.solid is required (config derivation.require).
+ ✖ TST1201 semantic.color.primary.solid is not authored — it is the one token the derivation engine cannot invent.
+   ↳ Author it as `semantic.color.primary.solid` (your brand color). A bare `semantic.color.primary` is a different path — the role grid anchors on the `.solid` cell.
```

## One more thing the repo caught

`check:encoding` — written three commits ago after the NUL-byte defect — failed this pass on `packages/core/src/diagnostics.js`, a file written _during_ it: two NUL bytes where spaces belonged, in a template literal, exactly the original defect's shape. It named the file, the line, the byte offset and rendered the byte visibly. The guard has now paid for itself on a live mistake rather than a reconstructed one.

`check:all` green at 62. All four examples still build byte-identically (`check:determinism`) and match their fixtures, so none of the derivation changes moved existing output.
