# Carbon's primary and secondary follow its real G100 button values

Found while refining #42. The Carbon example bound `primary.solid` to
`$link-primary`, and [the findings ledger](../findings/carbon-adoption.md) said
`$link-primary`, `$interactive` and `$button-primary` were "all Blue 60 light;
Blue 40 dark". `secondary.solid` was bound light-mode only, because its G100
value had never been confirmed.

## The defect

Carbon publishes its tokens as DTCG files in its own repository
([`packages/themes/src/dtcg`](https://github.com/carbon-design-system/carbon/tree/81893f3d925daa624c516ef3d4edf2e7f339d7db/packages/themes/src/dtcg)
at `81893f3`). Read against that source:

| Token               | White   | G100    | What the example had                  |
| ------------------- | ------- | ------- | ------------------------------------- |
| `$button-primary`   | Blue 60 | Blue 60 | not modeled; ledger said Blue 40 dark |
| `$link-primary`     | Blue 60 | Blue 40 | bound to `primary.solid`              |
| `$interactive`      | Blue 60 | Blue 50 | ledger said Blue 40 dark              |
| `$button-secondary` | Gray 80 | Gray 60 | Gray 80 in both modes                 |

So the example's dark primary button was Carbon's link colour, not its button
colour, and its dark secondary was the White theme's value.

## The fix

Julien chose to bind `primary.solid` to the button token. The example's Carbon
vocabulary gains `carbon.button-primary` (Blue 60, no dark override, as in
Carbon), `primary.solid` aliases it, and `carbon.button-secondary` gets its
G100 value (Gray 60). `link.*` keeps `$link-primary`. The ledger, the example
README, the examples page and the T11 review checklist now say what Carbon's
source says; the other G100 values bound in the example were checked against
the same files and all match (`$support-warning` is Yellow 30 in every theme,
which settles the second "not verified" note on the examples page).

## Measured

`transtyle explain … --mode dark` in `examples/carbon`:

| Slot (dark)          | Before    | After     |
| -------------------- | --------- | --------- |
| `primary.solid`      | `#78a9ff` | `#0f62fe` |
| `primary.on-solid`   | `#0a0a0a` | `#ffffff` |
| `secondary.solid`    | `#393939` | `#6f6f6f` |
| `secondary.on-solid` | `#ffffff` | `#ffffff` |

The dark primary button now carries white text, as Carbon's does. `transtyle
check` still passes with no warning; its informational `TST1204` notes moved
from `secondary`, `warning`, `neutral` to `primary`, `warning`, `neutral`, since
Carbon's primary is now, correctly, the same in both modes. The Carbon figure
was regenerated (`gen:figures`). On G100 `secondary` and `neutral` resolve to
the same Gray 60; that is Carbon's value for the secondary button, kept as is.
